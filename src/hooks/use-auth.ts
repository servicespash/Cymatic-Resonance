import { useContext } from "react";
import { Ctx } from "@/lib/auth-context-def";

export const useAuth = () => {
  const context = useContext(Ctx);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
