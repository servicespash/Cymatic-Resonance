import { createContext, useContext } from "react";

export type CallCtx = {
  activeCall: { id: string; kind: "audio" | "video"; initiator_id?: string } | null;
  isJoining: boolean;
  startCall: (
    channelId: string,
    recipientIds?: string[] | "audio" | "video",
    kind?: "audio" | "video",
  ) => Promise<void>;
  declineCall: (callId?: string) => Promise<void>;
  setActiveCall: (
    call: { id: string; kind: "audio" | "video"; initiator_id?: string } | null,
  ) => void;
  joinCall: (callId: string, kind?: "audio" | "video") => Promise<void>;
  leaveCall: () => Promise<void>;
  activeCallId: string | null;
};

export const Ctx = createContext<CallCtx>({
  activeCall: null,
  isJoining: false,
  startCall: async () => {},
  declineCall: async () => {},
  setActiveCall: () => {},
  joinCall: async () => {},
  leaveCall: async () => {},
  activeCallId: null,
});

export const useCallController = () => useContext(Ctx);
