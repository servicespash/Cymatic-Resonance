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
        console.log("AuthProvider: initAuth - starting getSession");
        
        // Race the getSession call against a 5-second timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Supabase auth check timed out")), 5000)
        );
        
        const { data, error } = await Promise.race([sessionPromise, timeoutPromise]) as { 
          data: { session: Session | null }; 
          error: any; 
        };

        if (error) {
            console.error("AuthProvider: initAuth - Auth Error", error);
            setDebugMsg("Auth Error: " + error.message);
            setLoading(false); // Ensure loading is set to false even on error
            return;
        }
        console.log("AuthProvider: initAuth - Session result:", data.session ? "Found" : "None");
        
        if (isMounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          setDebugMsg(data.session ? "Session found" : "No session");
        }
      } catch (err) {
        console.error("AuthProvider: initAuth - Catch Error", err);
        setDebugMsg("Catch Error: " + (err as Error).message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
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
