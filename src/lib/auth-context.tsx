import { createContext, useContext, useEffect, useState, useMemo } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Ctx } from "@/lib/auth-context-core";

export type { AuthCtx } from "@/lib/auth-context-def";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugMsg, setDebugMsg] = useState("Initializing...");

  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    async function initAuth() {
      try {
        setDebugMsg("Fetching session...");

        // Add a timeout to prevent hanging initialization
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Auth initialization timed out")), 5000),
        );

        const { data, error } = (await Promise.race([sessionPromise, timeoutPromise])) as any;

        if (error) {
          console.error("AuthProvider: initAuth - Auth Error", error);
          setDebugMsg("Auth Error: " + error.message);
        } else {
          console.log("AuthProvider: initAuth - Session result:", data.session ? "Found" : "None");
          if (isMounted) {
            setSession(data.session);
            setUser(data.session?.user ?? null);
            setDebugMsg(data.session ? "Session found" : "No session");
          }
        }
      } catch (err) {
        console.error("AuthProvider: initAuth - Catch Error", err);
        if (isMounted) setDebugMsg("Error: " + (err as Error).message);
      } finally {
        if (isMounted) {
          setLoading(false);
          // Subscribe only after initial check is done
          const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            if (isMounted) {
              setSession(session);
              setUser(session?.user ?? null);
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

  const value = useMemo(
    () => ({ session, user, loading, debugMsg }),
    [session, user, loading, debugMsg],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
