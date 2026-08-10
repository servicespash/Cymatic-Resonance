import { useContext } from "react";
import { Ctx } from "./auth-context";

export const useAuth = () => useContext(Ctx);
