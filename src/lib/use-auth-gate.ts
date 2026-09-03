import { useContext } from "react";
import { Ctx } from "@/lib/auth-context-core";
import type { AuthCtx } from "@/lib/auth-context-def";

export function useAuthGate() {
  const context = useContext(Ctx) as AuthCtx;
  if (!context) {
    throw new Error("useAuthGate must be used within an AuthProvider");
  }
  return {
    isReady: !context.loading,
    session: context.session,
    user: context.user,
  };
}
