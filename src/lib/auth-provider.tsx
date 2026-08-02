import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Ctx } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let initialized = false;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!initialized) {
        initialized = true;
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!initialized) {
        initialized = true;
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </Ctx.Provider>
  );
}
