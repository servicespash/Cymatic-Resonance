import type { Dispatch, SetStateAction } from "react";

// Re-using existing types inferred from the original file
export type Channel = {
  id: string;
  name: string;
  kind: "broadcast" | "dm" | "channel";
  org_id: string;
};
export type Msg = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  created_at: string;
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
  messages: Msg[];
  setMessages: Dispatch<SetStateAction<Msg[]>>;
  reactions: Reaction[];
  setReactions: Dispatch<SetStateAction<Reaction[]>>;
  senders: Record<string, Sender>;
  setSenders: Dispatch<SetStateAction<Record<string, Sender>>>;
  reads: Record<string, string>;
  setReads: Dispatch<SetStateAction<Record<string, string>>>;
  lastMessageByChannel: Record<string, Msg>;
  setLastMessageByChannel: Dispatch<SetStateAction<Record<string, Msg>>>;
  // ...

  // Actions
  setActiveChannel: (channel: Channel | null) => void;
  sendMessage: (body: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;

  loading: boolean;
}
