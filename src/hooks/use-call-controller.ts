import { createContext, useContext } from "react";

type CallCtx = {
  startCall: (channelId: string, recipientIds: string[], kind: "audio" | "video") => Promise<void>;
  joinCall: (callId: string, kind: "audio" | "video") => Promise<void>;
  activeCallId: string | null;
};

export const Ctx = createContext<CallCtx>({
  startCall: async () => {},
  joinCall: async () => {},
  activeCallId: null,
});
export const useCallController = () => useContext(Ctx);
