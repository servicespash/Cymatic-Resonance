import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

export const Ctx = createContext<AuthCtx>({ session: null, user: null, loading: true });

export const useAuth = () => {
  const context = useContext(Ctx);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
