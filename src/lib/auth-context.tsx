import { useEffect, useState, useMemo } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Ctx } from "@/lib/auth-context-core";

export type { AuthCtx } from "@/lib/auth-context-def";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    console.log("[Auth] Initializing authentication listener and session check...");

    // 1. Immediately subscribe to onAuthStateChange so no login/logout events are missed
    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log(`[Auth] onAuthStateChange event: ${event}`, newSession?.user?.email ?? "no user");
      if (isMounted) {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    });

    // 2. Fetch current session immediately
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error("[Auth] getSession error:", error);
        } else if (isMounted && data?.session) {
          console.log("[Auth] Initial session found:", data.session.user?.email);
          setSession(data.session);
          setUser(data.session.user);
        }
      })
      .catch((err) => {
        console.error("[Auth] getSession unexpected error:", err);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    // 3. Fallback safety timer to guarantee loading is never stuck
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading((current) => {
          if (current) {
            console.warn("[Auth] Safety timeout: resolving loading state.");
            return false;
          }
          return false;
        });
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ session, user, loading }), [session, user, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
