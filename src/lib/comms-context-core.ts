import { createContext } from "react";
import { CommsContextType } from "./comms-context-def";

export const CommsContext = createContext<CommsContextType | undefined>(undefined);
