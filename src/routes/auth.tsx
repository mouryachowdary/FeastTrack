import type React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) nav({ to: "/" }); });
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN") nav({ to: "/" }); });
    return () => data.subscription.unsubscribe();
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    if (error) toast.error(error.message);
    else if (mode === "up") toast.success("Check your email to confirm your account.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <h1 className="font-display text-4xl text-primary">FeastTrack</h1>
        <p className="mb-4 text-sm text-muted-foreground">Team members only. Sign in to see and edit orders.</p>
        <Button
          className="w-full"
          variant="outline"
          onClick={async () => {
            const { error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: window.location.origin },
            });
            if (error) toast.error("Google sign-in failed.");
          }}
        >
          Continue with Google
        </Button>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full">{mode === "in" ? "Sign in" : "Create account"}</Button>
        </form>
        <button className="mt-3 text-sm text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
