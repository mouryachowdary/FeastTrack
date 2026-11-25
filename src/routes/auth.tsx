import type React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordEmployeeLogin } from "@/lib/employee-auth.functions";
import { EMPLOYEE_ACTIVITY_SESSION_KEY } from "@/lib/employee-activity";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — FeastTrack" },
      {
        name: "description",
        content: "Sign in to manage the team's Thursday biryani orders and refunds.",
      },
      { property: "og:title", content: "Sign in — FeastTrack" },
      { property: "og:description", content: "Team sign-in for the Thursday biryani tracker." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsPasswordRecovery(true);
      if (event === "SIGNED_IN") nav({ to: "/" });
    });
    void supabase.auth.getSession().then(({ data: sessionData, error }) => {
      if (error) {
        console.error("Could not check the current sign-in session", error);
        return;
      }
      const recoveryLink =
        typeof window !== "undefined" && window.location.hash.includes("type=recovery");
      if (sessionData.session && !recoveryLink) nav({ to: "/" });
    });
    return () => data.subscription.unsubscribe();
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (isPasswordRecovery) {
        if (password.length < 8 || password.length > 14) {
          toast.error("Password must be between 8 and 14 characters.");
          return;
        }
        if (password !== confirmPassword) {
          toast.error("Passwords do not match.");
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) toast.error(error.message);
        else {
          toast.success("Password updated.");
          nav({ to: "/" });
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error(error.message);
      } else {
        try {
          const activity = await recordEmployeeLogin();
          sessionStorage.setItem(EMPLOYEE_ACTIVITY_SESSION_KEY, activity.activityId);
        } catch (activityError) {
          console.error("Sign-in succeeded, but activity could not be recorded", activityError);
          toast.error("Signed in, but login activity could not be recorded.");
        }
      }
    } catch (error) {
      console.error(isPasswordRecovery ? "Password update failed" : "Email sign-in failed", error);
      toast.error(
        isPasswordRecovery
          ? "Unable to update your password right now. Please try again."
          : "Unable to sign in right now. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <h1 className="font-display text-4xl text-primary">FeastTrack</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {isPasswordRecovery
            ? "Choose a new password for your FeastTrack account."
            : "Team members only. Sign in with your registered email and password."}
        </p>
        <form onSubmit={submit} className="space-y-3" aria-busy={isLoading}>
          {!isPasswordRecovery && (
            <Input
              type="email"
              placeholder="Email address"
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          )}
          <Input
            type="password"
            placeholder={isPasswordRecovery ? "New password" : "Password"}
            autoComplete={isPasswordRecovery ? "new-password" : "current-password"}
            maxLength={14}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
          />
          {isPasswordRecovery && (
            <Input
              type="password"
              placeholder="Confirm new password"
              autoComplete="new-password"
              maxLength={14}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? isPasswordRecovery
                ? "Updating password..."
                : "Signing in..."
              : isPasswordRecovery
                ? "Update password"
                : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
