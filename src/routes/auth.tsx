import type React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usernameToAuthEmail } from "@/lib/usernames";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — FeastTrack" },
      { name: "description", content: "Sign in to manage the team's Thursday biryani orders and refunds." },
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) nav({ to: "/" }); });
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN") nav({ to: "/" }); });
    return () => data.subscription.unsubscribe();
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const email = usernameToAuthEmail(username);
    if (!email) {
      toast.error("Use 1–50 letters, numbers, periods, underscores, or hyphens for your username.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error("Invalid username or password.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <h1 className="font-display text-4xl text-primary">FeastTrack</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Team members only. Sign in with your assigned username and password.
        </p>
        <form onSubmit={submit} className="space-y-3" autoComplete="off">
          <Input
            type="text"
            placeholder="Username"
            autoComplete="off"
            maxLength={50}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            maxLength={14}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </main>
  );
}
