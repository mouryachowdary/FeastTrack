import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const requireActiveUser = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ context, next }) => {
    const authorization = getRequest()?.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
    if (!token) throw new Error("Unauthorized");

    const { data, error } = await context.supabase.auth.getUser(token);
    if (error || !data.user || data.user.id !== context.userId) {
      if (error) console.error("Could not validate the active Supabase user", error);
      throw new Error("Unauthorized");
    }

    return next();
  });

const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireActiveUser])
  .server(async ({ context, next }) => {
    const { data, error } = await context.supabase.rpc("is_admin");
    if (error) {
      console.error("Could not verify administrator access", error);
      throw new Error("Unable to verify administrator access");
    }
    if (data !== true) throw new Error("Forbidden");
    return next();
  });

const createEmployeeInput = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  fullName: z.string().trim().min(1).max(150),
  initialPassword: z.string().min(8).max(14),
});

const employeeIdInput = z.object({ userId: z.string().uuid() });

const roleInput = employeeIdInput.extend({
  role: z.enum(["admin", "employee"]),
});

const profileInput = employeeIdInput.extend({
  fullName: z.string().trim().min(1).max(150),
});

const accessInput = employeeIdInput.extend({ active: z.boolean() });

const resetPasswordInput = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
});

export type EmployeeAccount = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
  active: boolean;
};

export type EmployeeActivity = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  loginAt: string;
  logoutAt: string | null;
};

export const recordEmployeeLogin = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("employee_activity")
      .insert({ user_id: context.userId })
      .select("id")
      .single();
    if (error) {
      console.error("Could not record employee login activity", error);
      throw new Error("Could not record login activity");
    }
    return { activityId: data.id };
  });

export const recordEmployeeLogout = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .validator(z.object({ activityId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin.rpc("record_employee_logout", {
      p_activity_id: data.activityId,
      p_user_id: context.userId,
    });
    if (error) {
      console.error("Could not record employee logout activity", error);
      throw new Error("Could not record logout activity");
    }
    if (!updated) throw new Error("This activity session is already closed or unavailable");
    return { recorded: true };
  });

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("User Authentication")
      .select("*")
      .order("full_name", { ascending: true });
    if (profileError) {
      console.error("Could not load employee profiles", profileError);
      throw new Error("Could not load employee profiles");
    }

    const authUsers = [];
    for (let page = 1; ; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 100,
      });
      if (error) {
        console.error("Could not load employee Auth accounts", error);
        throw new Error("Could not load employee accounts");
      }
      authUsers.push(...data.users);
      if (data.users.length < 100) break;
    }

    const authById = new Map(authUsers.map((authUser) => [authUser.id, authUser]));
    return profiles.map((profile): EmployeeAccount => {
      const authUser = authById.get(profile.id);
      return {
        id: profile.id,
        email: authUser?.email ?? "",
        fullName: profile.full_name,
        role: profile.role,
        createdAt: profile["created-at"],
        active:
          authUser != null &&
          (!authUser.banned_until || Date.parse(authUser.banned_until) <= Date.now()),
      };
    });
  });

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(createEmployeeInput)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: inviteError } = await supabaseAdmin
      .from("team_invites")
      .upsert({ email: data.email }, { onConflict: "email", ignoreDuplicates: true });
    if (inviteError) {
      console.error("Could not create the employee team invitation", inviteError);
      throw new Error("Could not prepare team access for this employee");
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.initialPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createError) {
      console.error("Could not create employee Auth account", createError);
      if (
        createError.code === "email_exists" ||
        /already (registered|exists)/i.test(createError.message)
      ) {
        throw new Error("An Auth account already uses this email");
      }
      throw new Error("Could not create employee account");
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("User Authentication")
      .select("*")
      .eq("id", created.user.id)
      .maybeSingle();
    if (profileError) {
      console.error("Could not verify the employee profile", profileError);
      throw new Error("The Auth account was created, but its profile could not be verified");
    }
    if (!profile || profile.full_name !== data.fullName || profile.role !== "employee") {
      throw new Error("The Auth account was created, but its employee profile is incomplete");
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("team_members")
      .select("user_id")
      .eq("user_id", created.user.id)
      .maybeSingle();
    if (membershipError) {
      console.error("Could not verify employee team access", membershipError);
      throw new Error("The account was created, but team access could not be verified");
    }
    if (!membership) {
      const { error } = await supabaseAdmin
        .from("team_members")
        .insert({ user_id: created.user.id, email: data.email });
      if (error) {
        console.error("Could not add the employee to the team", error);
        throw new Error("The account was created, but team access could not be assigned");
      }
    }
    return { created: true };
  });

export const updateEmployeeRole = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(roleInput)
  .handler(async ({ context, data }) => {
    if (data.userId === context.userId) {
      throw new Error("Administrators cannot change their own role");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("User Authentication")
      .update({ role: data.role })
      .eq("id", data.userId)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("Could not update employee role", error);
      throw new Error("Could not update employee role");
    }
    if (!profile) throw new Error("Employee profile not found");
    return { updated: true };
  });

export const updateEmployeeProfile = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(profileInput)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("User Authentication")
      .update({ full_name: data.fullName })
      .eq("id", data.userId)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("Could not update employee profile name", error);
      throw new Error("Could not update employee profile");
    }
    if (!profile) throw new Error("Employee profile not found");
    return { updated: true };
  });

export const setEmployeeAccess = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(accessInput)
  .handler(async ({ context, data }) => {
    if (data.userId === context.userId) {
      throw new Error("Administrators cannot deactivate their own account");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("User Authentication")
      .select("id,role")
      .eq("id", data.userId)
      .maybeSingle();
    if (profileError) {
      console.error("Could not verify employee profile before changing access", profileError);
      throw new Error("Could not verify employee account");
    }
    if (!profile) throw new Error("Employee profile not found");
    if (profile.role !== "employee") {
      throw new Error("Only employee accounts can be deactivated");
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      data.userId,
    );
    if (authError || !authData.user?.email) {
      if (authError) console.error("Could not load employee Auth account", authError);
      throw new Error("Could not load employee Auth account");
    }

    if (data.active) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        ban_duration: "none",
      });
      if (error) {
        console.error("Could not reactivate employee Auth account", error);
        throw new Error("Could not reactivate employee account");
      }
      const { error: membershipError } = await supabaseAdmin
        .from("team_members")
        .upsert({ user_id: data.userId, email: authData.user.email }, { onConflict: "user_id" });
      if (membershipError) {
        console.error("Could not restore employee team access", membershipError);
        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
          ban_duration: "876000h",
        });
        if (banError) {
          console.error(
            "Could not deactivate account after failed team access restoration",
            banError,
          );
          throw new Error(
            "Team access could not be restored and the account may still be active; administrator review is required",
          );
        }
        throw new Error("Could not restore employee team access");
      }
      return { active: true };
    }

    const { error: membershipError } = await supabaseAdmin
      .from("team_members")
      .delete()
      .eq("user_id", data.userId);
    if (membershipError) {
      console.error("Could not remove employee team access", membershipError);
      throw new Error("Could not deactivate employee team access");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: "876000h",
    });
    if (error) {
      console.error("Could not deactivate employee Auth account", error);
      const { error: restoreError } = await supabaseAdmin
        .from("team_members")
        .upsert({ user_id: data.userId, email: authData.user.email }, { onConflict: "user_id" });
      if (restoreError) {
        console.error("Could not restore team access after failed deactivation", restoreError);
        throw new Error(
          "Could not deactivate the account or restore team access; administrator review is required",
        );
      }
      throw new Error("Could not deactivate employee account");
    }
    return { active: false };
  });

export const sendEmployeePasswordReset = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(resetPasswordInput)
  .handler(async ({ data }) => {
    const appBaseUrl = process.env["APP_BASE_URL"];
    if (!appBaseUrl) throw new Error("APP_BASE_URL is required to send password reset emails");
    let redirectTo: string;
    try {
      const baseUrl = new URL(appBaseUrl);
      if (
        (baseUrl.protocol !== "https:" &&
          !(
            baseUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(baseUrl.hostname)
          )) ||
        baseUrl.username ||
        baseUrl.password
      ) {
        throw new Error("APP_BASE_URL must use HTTPS and cannot contain credentials");
      }
      redirectTo = new URL("/auth", baseUrl).toString();
    } catch (error) {
      console.error("APP_BASE_URL is invalid", error);
      throw new Error("APP_BASE_URL must be a valid HTTPS application URL");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo,
    });
    if (error) {
      console.error("Could not send employee password reset email", error);
      throw new Error("Could not send password reset email");
    }
    return { sent: true };
  });

export const listEmployeeActivity = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles, error: profileError }, { data: activities, error }] =
      await Promise.all([
        supabaseAdmin.from("User Authentication").select("id,full_name"),
        supabaseAdmin
          .from("employee_activity")
          .select("id,user_id,login_at,logout_at")
          .order("login_at", { ascending: false })
          .limit(200),
      ]);
    if (profileError) {
      console.error("Could not load employee profiles for activity", profileError);
      throw new Error("Could not load employee activity");
    }
    if (error) {
      console.error("Could not load employee activity", error);
      throw new Error("Could not load employee activity");
    }

    const profileById = new Map(profiles.map((profile) => [profile.id, profile.full_name]));
    const authUsers = [];
    for (let page = 1; ; page += 1) {
      const { data, error: authError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 100,
      });
      if (authError) {
        console.error("Could not load employee emails for activity", authError);
        throw new Error("Could not load employee activity");
      }
      authUsers.push(...data.users);
      if (data.users.length < 100) break;
    }
    const emailById = new Map(authUsers.map((authUser) => [authUser.id, authUser.email ?? ""]));

    return activities.map((activity): EmployeeActivity => ({
      id: activity.id,
      userId: activity.user_id,
      fullName: profileById.get(activity.user_id) ?? "Unknown employee",
      email: emailById.get(activity.user_id) ?? "",
      loginAt: activity.login_at,
      logoutAt: activity.logout_at,
    }));
  });
