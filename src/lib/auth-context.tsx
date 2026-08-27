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

    async function initAuth() {
      try {
        setDebugMsg("Fetching session...");
        const { data, error } = await supabase.auth.getSession();
        if (error) {
            setDebugMsg("Auth Error: " + error.message);
            setLoading(false); // Ensure loading is set to false even on error
            return;
        }
        if (isMounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          setDebugMsg(data.session ? "Session found" : "No session");
          setLoading(false); // Only set loading to false here
        }
      } catch (err) {
        setDebugMsg("Catch Error: " + (err as Error).message);
        setLoading(false);
      }
    }

    initAuth();

    try {
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (isMounted) {
            setSession(session);
            setUser(session?.user ?? null);
            // Don't set loading here again, it should have been handled by initAuth
          }
        });

        return () => {
          isMounted = false;
          subscription.unsubscribe();
        };
    } catch (err) {
        setDebugMsg("Auth Subscription Error: " + (err as Error).message);
        return () => {
            isMounted = false;
        };
    }
  }, []);

  const value = useMemo(() => ({ session, user, loading, debugMsg }), [session, user, loading, debugMsg]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
