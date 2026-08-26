import type { Dispatch, SetStateAction } from "react";

// Re-using existing types inferred from the original file
export type Channel = { id: string; name: string; kind: "broadcast" | "dm"; org_id: string };
export type Msg = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  deleted_at?: string | null;
};
export type Sender = { id: string; full_name: string | null; role: string };
export type Thread = {
  id: string;
  channel_id: string;
  user_a: string;
  user_b: string;
  last_message_at: string;
};
export type Reaction = { id: string; message_id: string; user_id: string; emoji: string };

export interface CommsContextType {
  channels: Channel[];
  setChannels: Dispatch<SetStateAction<Channel[]>>;
  threads: Thread[];
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  activeChannel: Channel | null;
  setActiveChannel: (channel: Channel | null) => void;
  messages: Msg[];
  setMessages: Dispatch<SetStateAction<Msg[]>>;
  reactions: Reaction[];
  setReactions: Dispatch<SetStateAction<Reaction[]>>;
  senders: Record<string, Sender>;
  setSenders: Dispatch<SetStateAction<Record<string, Sender>>>;
  ensureSender: (senderId: string) => Promise<Sender | null>;
  reads: Record<string, string>;
  setReads: Dispatch<SetStateAction<Record<string, string>>>;
  lastMessageByChannel: Record<string, Msg>;
  setLastMessageByChannel: Dispatch<SetStateAction<Record<string, Msg>>>;

  // Actions
  sendMessage: (
    body: string,
    files: File[],
    audio?: { blob: Blob; mime: string; ext: string; durationMs?: number } | null,
  ) => Promise<void>;
  startDm: (otherId: string) => Promise<void>;

  loading: boolean;
  sending: boolean;
}
