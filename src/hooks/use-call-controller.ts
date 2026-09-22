import { createContext, useContext } from "react";

type CallCtx = {
  startCall: (channelId: string, recipientIds: string[], kind: "audio" | "video") => Promise<void>;
  joinCall: (callId: string, kind: "audio" | "video") => Promise<void>;
  leaveCall: () => Promise<void>;
  activeCallId: string | null;
  isJoining: boolean;
  openInitiationModal: (channelId: string, recipientIds: string[], targetName: string) => void;
};

export const Ctx = createContext<CallCtx>({
  startCall: async () => {},
  joinCall: async () => {},
  leaveCall: async () => {},
  activeCallId: null,
  isJoining: false,
  openInitiationModal: () => {},
});
export const useCallController = () => useContext(Ctx);
