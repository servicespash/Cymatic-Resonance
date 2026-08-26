import React, { useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CommsContextType, Channel, Msg, Thread, Reaction, Sender } from "./comms-context-def";
import { CommsContext } from "./comms-context-core";
import { uploadAttachment, persistAttachmentMetadata } from "./attachment-manager";
import { useAuth } from "./use-auth";

export const CommsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [channels, setChannels] = React.useState<Channel[]>([]);
  const [threads, setThreads] = React.useState<Thread[]>([]);
  const [activeChannel, setActiveChannel] = React.useState<Channel | null>(null);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [reactions, setReactions] = React.useState<Reaction[]>([]);
  const [senders, setSenders] = React.useState<Record<string, Sender>>({});
  const [reads, setReads] = React.useState<Record<string, string>>({});
  const [lastMessageByChannel, setLastMessageByChannel] = React.useState<Record<string, Msg>>({});
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);

  const sendMessage = async (
    body: string,
    files: File[],
    audio?: { blob: Blob; mime: string; ext: string; durationMs?: number } | null,
  ) => {
    if (!activeChannel || !user) return;
    setSending(true);
    try {
      const { data: msg, error } = await supabase
        .from("messages")
        .insert({
          channel_id: activeChannel.id,
          org_id: activeChannel.org_id,
          sender_id: user.id,
          body,
        })
        .select()
        .single();
      if (error) throw error;

      for (const file of files) {
        const path = await uploadAttachment(
          file,
          activeChannel.org_id,
          activeChannel.id,
          msg.id,
          file.name,
        );
        await persistAttachmentMetadata({
          message_id: msg.id,
          org_id: activeChannel.org_id,
          uploader_id: user.id,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
          kind: file.type.startsWith("image/") ? "image" : "file",
          filename: file.name,
        });
      }
      if (audio) {
        const path = await uploadAttachment(
          audio.blob,
          activeChannel.org_id,
          activeChannel.id,
          msg.id,
          `voice-${Date.now()}.${audio.ext}`,
        );
        await persistAttachmentMetadata({
          message_id: msg.id,
          org_id: activeChannel.org_id,
          uploader_id: user.id,
          storage_path: path,
          mime_type: audio.mime,
          size_bytes: audio.blob.size,
          kind: "audio",
          filename: `voice.${audio.ext}`,
          duration_ms: audio.durationMs,
        });
      }
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      setSending(false);
    }
  };
  const startDm = async (otherId: string) => {
    try {
      const { data, error } = await supabase.rpc("open_dm", { _other: otherId });
      if (error) throw error;
      if (data) {
        // open_dm RPC returns direct_threads Row single object type, not an array
        const thread = data as unknown as { channel_id: string; org_id: string };
        setActiveChannel({
          id: thread.channel_id,
          name: "Direct Thread",
          kind: "dm",
          org_id: thread.org_id,
        });
      }
    } catch (e) {
      console.error("Failed to start DM:", e);
    }
  };

  const ensureSender = async (senderId: string) => {
    if (senders[senderId]) return senders[senderId];
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, avatar_url")
      .eq("id", senderId)
      .single();
    if (!error && data) {
      setSenders((prev) => ({ ...prev, [senderId]: data as unknown as Sender }));
      return data as unknown as Sender;
    }
    return null;
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
    ensureSender,
    reads,
    setReads,
    lastMessageByChannel,
    setLastMessageByChannel,
    sendMessage,
    startDm,
    loading,
    sending,
  };

  return <CommsContext.Provider value={value}>{children}</CommsContext.Provider>;
};
