import { useState, ReactNode } from "react";
import { CommsContext, Channel, Msg, Thread, Reaction, Sender } from "./comms-context-def";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const CommsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [senders, setSenders] = useState<Record<string, Sender>>({});
  const [reads, setReads] = useState<Record<string, string>>({});
  const [lastMessageByChannel, setLastMessageByChannel] = useState<Record<string, Msg>>({});
  const [loading] = useState(true);

  const sendMessage = async (body: string): Promise<void> => {
    if (!activeChannel || !user) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!p?.org_id) return;
    const { error } = await supabase.from("messages").insert({
      channel_id: activeChannel.id,
      org_id: p.org_id,
      sender_id: user.id,
      body: body,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
  };

  const startDm = async (otherId: string): Promise<void> => {
    if (!user) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!p?.org_id) return;
    const orgId = p.org_id;

    const existing = threads.find(
      (t) =>
        (t.user_a === user.id && t.user_b === otherId) ||
        (t.user_b === user.id && t.user_a === otherId),
    );
    if (existing) {
      const ch = channels.find((c) => c.id === existing.channel_id);
      if (ch) {
        setActiveChannel(ch);
        return;
      }
    }

    const { data: ch, error: chErr } = await supabase
      .from("channels")
      .insert({
        name: `dm-${user.id.slice(0, 4)}-${otherId.slice(0, 4)}`,
        kind: "dm",
        org_id: orgId,
        created_by: user.id,
      })
      .select()
      .single();
    if (chErr || !ch) {
      toast.error(chErr?.message ?? "Could not start chat");
      return;
    }

    const { data: th, error: thErr } = await supabase
      .from("direct_threads")
      .insert({ org_id: orgId, channel_id: ch.id, user_a: user.id, user_b: otherId })
      .select()
      .single();
    if (thErr) {
      toast.error(thErr.message);
      return;
    }

    setChannels((prev) => [...prev, ch as Channel]);
    if (th) setThreads((prev) => [th, ...prev]);
    setActiveChannel(ch as Channel);
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
    startDm,
    loading,
  };

  return <CommsContext.Provider value={value}>{children}</CommsContext.Provider>;
};
