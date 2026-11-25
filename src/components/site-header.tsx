import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usernameToAuthEmail } from "@/lib/usernames";

export function SiteHeader() {
  const [invite, setInvite] = useState("");
  return (
    <header className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-6 py-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] opacity-80">Night Shift · Every Thursday</p>
          <h1 className="font-display text-5xl md:text-7xl">FeastTrack</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2 font-mono text-sm">
          <Link to="/" className="rounded-full px-4 py-2 hover:bg-primary-foreground/10" activeProps={{ className: "bg-primary-foreground/15" }} activeOptions={{ exact: true }}>This week</Link>
          <Link to="/reports" className="rounded-full px-4 py-2 hover:bg-primary-foreground/10" activeProps={{ className: "bg-primary-foreground/15" }}>Reports</Link>
          <form
            className="flex gap-1"
            onSubmit={async (e) => {
              e.preventDefault();
              const email = usernameToAuthEmail(invite);
              if (!email) {
                toast.error("Use 1–50 letters, numbers, periods, underscores, or hyphens.");
                return;
              }
              const { error } = await supabase.from("team_invites").insert({ email });
              if (error) toast.error("Couldn't invite.");
              else {
                toast.success("Username invited. Create its account in Supabase.");
                setInvite("");
              }
            }}
          >
            <input
              type="text"
              required
              maxLength={50}
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="Invite username"
              className="h-9 w-40 rounded-full bg-primary-foreground/10 px-3 placeholder:text-primary-foreground/60"
            />
            <button className="rounded-full px-3 hover:bg-primary-foreground/10">Invite</button>
          </form>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }} className="rounded-full px-4 py-2 hover:bg-primary-foreground/10">Sign out</button>
        </nav>
      </div>
    </header>
  );
}
