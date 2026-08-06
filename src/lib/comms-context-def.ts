import { type Tables } from "@/integrations/supabase/types";

// Re-using existing types inferred from the original file
export type Channel = { id: string; name: string; kind: "broadcast" | "dm"; org_id: string };
export type Msg = { id: string; channel_id: string; sender_id: string; body: string; created_at: string };
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
  setChannels: (channels: Channel[]) => void;
  threads: Thread[];
  setThreads: (threads: Thread[]) => void;
  activeChannel: Channel | null;
  messages: Msg[];
  setMessages: (messages: Msg[]) => void;
  reactions: Reaction[];
  setReactions: (reactions: Reaction[]) => void;
  senders: Record<string, Sender>;
  reads: Record<string, string>;
  lastMessageByChannel: Record<string, Msg>;
  
  // Actions
  setActiveChannel: (channel: Channel | null) => void;
  sendMessage: (body: string) => Promise<void>;
  // ... future actions: addReaction, deleteMessage, etc.
  
  loading: boolean;
}
