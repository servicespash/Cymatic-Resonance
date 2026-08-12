import { useContext } from "react";
import { Ctx } from "./auth-context-core";

export const useAuth = () => useContext(Ctx);
