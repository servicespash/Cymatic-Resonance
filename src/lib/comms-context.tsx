import { createContext, useContext, useState, ReactNode } from "react";
import { CommsContextType, Channel, Msg, Thread, Reaction, Sender } from "./comms-context-def";

const CommsContext = createContext<CommsContextType | undefined>(undefined);

export const CommsProvider = ({ children }: { children: ReactNode }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [senders, setSenders] = useState<Record<string, Sender>>({});
  const [reads, setReads] = useState<Record<string, string>>({});
  const [lastMessageByChannel, setLastMessageByChannel] = useState<Record<string, Msg>>({});
  const [loading, setLoading] = useState(true);

  const sendMessage = async (body: string) => {
    console.log("Sending message:", body);
    // Logic will be lifted from comms.tsx in the next steps
  };

  const deleteMessage = async (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  const deleteChat = async (chatId: string) => {
    setThreads((prev) => prev.filter((t) => t.channel_id !== chatId));
  };

  const value = {
    channels,
    setChannels,
    threads,
    setThreads,
    activeChannel,
    setActiveChannel,
    messages,
    setMessages,
    reactions,
    setReactions,
    senders,
    setSenders,
    reads,
    setReads,
    lastMessageByChannel,
    setLastMessageByChannel,
    sendMessage,
    deleteMessage,
    deleteChat,
    loading,
  };

  return <CommsContext.Provider value={value}>{children}</CommsContext.Provider>;
};

export const useComms = () => {
  const context = useContext(CommsContext);
  if (context === undefined) {
    throw new Error("useComms must be used within a CommsProvider");
  }
  return context;
};
