import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type Attachment } from "@/components/comm-attachment";
import { type RecordedAudio } from "@/components/voice-recorder";
import { getNotificationPrefs } from "@/lib/notifications";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function useMessageSender(
  orgId: string | null,
  channelId: string | null,
  userId: string | undefined,
) {
  const [sending, setSending] = useState(false);

  const kindOf = (mime: string): "image" | "audio" | "file" =>
    mime.startsWith("image/") ? "image" : mime.startsWith("audio/") ? "audio" : "file";

  const uploadOne = async (
    file: Blob,
    filename: string,
    mime: string,
    messageId: string,
    extra: Partial<Attachment> = {},
  ) => {
    if (!orgId || !channelId || !userId) return;
    const safe = filename.replace(/[^\w.-]+/g, "_");
    const path = `${orgId}/${channelId}/${messageId}/${crypto.randomUUID()}-${safe}`;

    const { error: upErr } = await supabase.storage.from("comm-attachments").upload(path, file, {
      contentType: mime,
      upsert: false,
    });
    if (upErr) throw upErr;

    const { error: insErr } = await supabase.from("message_attachments").insert({
      message_id: messageId,
      org_id: orgId,
      uploader_id: userId,
      storage_path: path,
      mime_type: mime,
      size_bytes: (file as File).size ?? (file as Blob).size,
      kind: kindOf(mime),
      filename: safe,
      ...extra,
    });
    if (insErr) throw insErr;
  };

  const sendMessage = async (text: string, files: File[], audio?: RecordedAudio) => {
    if (!userId || !channelId || !orgId) return;
    if (!text && files.length === 0 && !audio) return;

    const prefs = getNotificationPrefs();
    let bodyToStore = text || "";
    if (prefs.encryptedChatMode && bodyToStore.trim()) {
      // Wrap payload with E2EE header marker if encrypted mode is active
      if (!bodyToStore.startsWith("[e2ee]")) {
        bodyToStore = `[e2ee]${bodyToStore}`;
      }
    }

    setSending(true);
    try {
      const { data: msg, error } = await supabase
        .from("messages")
        .insert({ org_id: orgId, channel_id: channelId, sender_id: userId, body: bodyToStore })
        .select()
        .single();

      if (error || !msg) throw error ?? new Error("send failed");

      const uploads: Promise<void>[] = [];
      for (const f of files)
        uploads.push(uploadOne(f, f.name, f.type || "application/octet-stream", msg.id));
      if (audio)
        uploads.push(
          uploadOne(audio.blob, `voice-${Date.now()}.${audio.ext}`, audio.mime, msg.id, {
            duration_ms: audio.durationMs,
          }),
        );

      const results = await Promise.allSettled(uploads);
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) toast.error(`${failed} attachment(s) failed to upload`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
      throw e;
    } finally {
      setSending(false);
    }
  };

  return { sendMessage, sending, MAX_FILE_BYTES };
}
