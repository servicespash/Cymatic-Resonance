import { useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Ctx } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session] = useState<Session | null>(null);
  const [loading] = useState(false);

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </Ctx.Provider>
  );
}
