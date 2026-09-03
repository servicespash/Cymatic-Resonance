import { createContext } from "react";
import type { AuthCtx } from "@/lib/auth-context-def";

export const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  loading: true,
  debugMsg: "Initializing...",
});
