import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-context";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { profile, status } = useAuth();

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-background p-8 text-foreground">Loading your profile…</main>
    );
  }
  if (status === "missing_profile") {
    return (
      <main className="min-h-screen bg-background p-8 text-foreground">
        <h1 className="font-display text-4xl text-primary">Profile unavailable</h1>
        <p className="mt-2 text-muted-foreground">
          Your account is signed in, but its employee profile is missing. Contact an administrator.
        </p>
        <button className="mt-4 underline" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </button>
      </main>
    );
  }
  if (status !== "ready" || !profile) {
    return (
      <main className="min-h-screen bg-background p-8 text-foreground">
        <h1 className="font-display text-4xl text-primary">Unable to load your profile</h1>
        <p className="mt-2 text-muted-foreground">Refresh the page or sign out and try again.</p>
      </main>
    );
  }

  return <Outlet />;
}
