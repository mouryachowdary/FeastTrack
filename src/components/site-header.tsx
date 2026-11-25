import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-context";
import { recordEmployeeLogout } from "@/lib/employee-auth.functions";
import { EMPLOYEE_ACTIVITY_SESSION_KEY } from "@/lib/employee-activity";

export function SiteHeader() {
  const [invite, setInvite] = useState("");
  const { profile } = useAuth();

  async function signOut() {
    const activityId = sessionStorage.getItem(EMPLOYEE_ACTIVITY_SESSION_KEY);
    if (activityId) {
      try {
        await recordEmployeeLogout({ data: { activityId } });
        sessionStorage.removeItem(EMPLOYEE_ACTIVITY_SESSION_KEY);
      } catch (error) {
        console.error("Could not record employee logout activity", error);
        toast.error("Logout activity could not be recorded; this session will remain unconfirmed.");
      }
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Could not sign out", error);
      toast.error("Could not sign out. Please try again.");
      return;
    }
    window.location.href = "/auth";
  }

  return (
    <header className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-6 py-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] opacity-80">
            Night Shift · Every Thursday
          </p>
          <h1 className="font-display text-5xl md:text-7xl">FeastTrack</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2 font-mono text-sm">
          <Link
            to="/"
            className="rounded-full px-4 py-2 hover:bg-primary-foreground/10"
            activeProps={{ className: "bg-primary-foreground/15" }}
            activeOptions={{ exact: true }}
          >
            This week
          </Link>
          <Link
            to="/reports"
            className="rounded-full px-4 py-2 hover:bg-primary-foreground/10"
            activeProps={{ className: "bg-primary-foreground/15" }}
          >
            Reports
          </Link>
          {profile?.role === "admin" && (
            <a
              href="/#employee-management"
              className="rounded-full px-4 py-2 hover:bg-primary-foreground/10"
            >
              Employees
            </a>
          )}
          {profile && (
            <span className="px-2 text-xs">
              {profile.full_name} · {profile.role}
            </span>
          )}
          <form
            className="flex gap-1"
            onSubmit={async (e) => {
              e.preventDefault();
              const email = invite.trim().toLowerCase();
              const { error } = await supabase.from("team_invites").insert({ email });
              if (error) toast.error("Couldn't invite.");
              else {
                toast.success("Email invited. An administrator must create the account.");
                setInvite("");
              }
            }}
          >
            <input
              type="email"
              required
              maxLength={254}
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="Invite email"
              className="h-9 w-40 rounded-full bg-primary-foreground/10 px-3 placeholder:text-primary-foreground/60"
            />
            <button className="rounded-full px-3 hover:bg-primary-foreground/10">Invite</button>
          </form>
          <button
            onClick={() => void signOut()}
            className="rounded-full px-4 py-2 hover:bg-primary-foreground/10"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
