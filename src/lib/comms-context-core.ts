import { createContext } from "react";
import { CommsContextType } from "./comms-context-def";

// Providing a dummy default value to avoid undefined context errors,
// though providers should always be present in the tree.
export const CommsContext = createContext<CommsContextType>({} as CommsContextType);
