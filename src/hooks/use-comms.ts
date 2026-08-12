import { useContext } from "react";
import { CommsContext } from "@/lib/comms-context-def";

export const useComms = () => {
  const context = useContext(CommsContext);
  if (context === undefined) {
    throw new Error("useComms must be used within a CommsProvider");
  }
  return context;
};
