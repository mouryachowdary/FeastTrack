import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export type EmployeeProfile = Tables<"User Authentication">;
export type EmployeeRole = "admin" | "employee";

type AuthState = "loading" | "signed_out" | "ready" | "missing_profile" | "error";

type AuthContextValue = {
  user: User | null;
  profile: EmployeeProfile | null;
  status: AuthState;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [status, setStatus] = useState<AuthState>("loading");
  const requestId = useRef(0);

  const loadSession = useCallback(async (session: Session | null) => {
    const request = ++requestId.current;
    setProfile(null);

    if (!session) {
      setUser(null);
      setStatus("signed_out");
      return;
    }

    try {
      setStatus("loading");
      const { data: userData, error: userError } = await supabase.auth.getUser(
        session.access_token,
      );
      if (request !== requestId.current) return;
      if (userError || !userData.user) {
        if (userError) console.error("Could not validate the current Supabase user", userError);
        setUser(null);
        setStatus("error");
        return;
      }

      setUser(userData.user);
      const { data: profileData, error: profileError } = await supabase
        .from("User Authentication")
        .select("*")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (request !== requestId.current) return;
      if (profileError) {
        console.error("Could not load the employee profile", profileError);
        setStatus("error");
        return;
      }
      if (!profileData) {
        setStatus("missing_profile");
        return;
      }
      if (profileData.role !== "admin" && profileData.role !== "employee") {
        console.error("The employee profile has an unsupported role");
        setStatus("error");
        return;
      }

      setProfile(profileData);
      setStatus("ready");
    } catch (error) {
      if (request !== requestId.current) return;
      console.error("Could not load the authenticated employee profile", error);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        if (mounted) void loadSession(session);
      }, 0);
    });

    return () => {
      mounted = false;
      requestId.current += 1;
      data.subscription.unsubscribe();
    };
  }, [loadSession]);

  const refreshProfile = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Could not refresh the employee profile", error);
        setStatus("error");
        return;
      }
      await loadSession(data.session);
    } catch (error) {
      console.error("Could not refresh the employee profile", error);
      setStatus("error");
    }
  }, [loadSession]);

  return (
    <AuthContext.Provider value={{ user, profile, status, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// The provider and its hook intentionally share one context module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
