import { createContext, useContext, useEffect, useState, useMemo } from "react";
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
    let subscription: { unsubscribe: () => void } | null = null;

    console.log("[Auth] State transition: -> initializing");

    async function initAuth() {
      try {
        // Fallback timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Auth initialization timed out")), 30000),
        );

        const { data, error } = (await Promise.race([sessionPromise, timeoutPromise])) as Awaited<
          ReturnType<typeof supabase.auth.getSession>
        >;

        if (error) {
          console.error("[Auth] getSession error:", error);
        } else {
          if (isMounted) {
            const hasSession = !!data.session;
            console.log(
              `[Auth] State transition: initializing -> ${hasSession ? "authenticated" : "unauthenticated"} (Initial)`,
            );
            setSession(data.session);
            setUser(data.session?.user ?? null);
          }
        }
      } catch (err) {
        console.error("[Auth] initialization catch error:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
          // Subscribe only after initial check is done
          const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
            console.log(`[Auth] onAuthStateChange event: ${event}`);
            if (isMounted) {
              setSession((prevSession) => {
                // Prevent unneeded re-renders on same access token
                if (prevSession?.access_token === newSession?.access_token) return prevSession;
                return newSession;
              });
              setUser((prevUser) => {
                // Prevent unneeded re-renders on same user ID
                if (prevUser?.id === newSession?.user?.id) return prevUser;
                const hasSession = !!newSession?.user;
                console.log(
                  `[Auth] State transition: -> ${hasSession ? "authenticated" : "unauthenticated"} (Event: ${event})`,
                );
                return newSession?.user ?? null;
              });
            }
          });
          subscription = data.subscription;
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ session, user, loading }), [session, user, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
