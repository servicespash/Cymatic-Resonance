import { createContext, useContext } from "react";

export type ActiveCallInfo = {
  id: string;
  channel_id: string;
  kind: "audio" | "video";
  initiator_id: string;
  created_at: string;
  status: string;
};

type CallCtx = {
  startCall: (channelId: string, recipientIds: string[], kind: "audio" | "video") => Promise<void>;
  joinCall: (callId: string, kind: "audio" | "video") => Promise<void>;
  leaveCall: () => Promise<void>;
  activeCallId: string | null;
  activeCalls: Record<string, ActiveCallInfo>;
};

export const Ctx = createContext<CallCtx>({
  startCall: async () => {},
  joinCall: async () => {},
  leaveCall: async () => {},
  activeCallId: null,
  activeCalls: {},
});

export const useCallController = () => useContext(Ctx);
