import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AuthCtx } from "@/lib/auth-context-def";
import type { Profile } from "@/types";

export type { AuthCtx } from "@/lib/auth-context-def";

export const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === "admin";

  const fetchProfile = useCallback(async (uid: string, isMounted: boolean) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, org_id, category, position, phone")
        .eq("id", uid)
        .maybeSingle();

      if (error) throw error;
      if (isMounted) setProfile(data as Profile | null);
    } catch (err) {
      console.error("[Auth Context] Failed to fetch profile:", err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id, true);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      // Safety timeout: if auth hasn't initialized in 6 seconds, force clear loading
      const timer = setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 6000);

      try {
        const { data } = await supabase.auth.getSession();
        if (isMounted) {
          const session = data.session;
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            // Fetch profile but don't let it block loading state indefinitely
            fetchProfile(session.user.id, isMounted).catch((err) => {
              console.error("[Auth Context] Profile fetch failed during init:", err);
            });
          }
        }
      } catch (err) {
        console.error("[Auth Context] Failed to fetch session:", err);
      } finally {
        if (isMounted) {
          clearTimeout(timer);
          setLoading(false);
        }
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (session?.user) {
          await fetchProfile(session.user.id, isMounted);
        }
      } else if (event === "SIGNED_OUT") {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const value = useMemo(
    () => ({ session, user, profile, isAdmin, loading, refreshProfile }),
    [session, user, profile, isAdmin, loading, refreshProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useAuth = () => {
  const context = useContext(Ctx);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
