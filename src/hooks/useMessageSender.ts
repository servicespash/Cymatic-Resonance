import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useMessageSender(
  orgId: string | null,
  userId: string | undefined,
  activeChannelId: string | undefined,
) {
  const [sending, setSending] = useState(false);

  const sendMessage = useCallback(
    async (
      body: string,
      files: File[] = [],
      audio?: { blob: Blob; mime: string; ext: string; durationMs?: number } | null,
    ) => {
      if (!orgId || !userId || !activeChannelId) return;

      setSending(true);
      try {
        const { data: msgData, error: msgError } = await supabase
          .from("messages")
          .insert({
            channel_id: activeChannelId,
            sender_id: userId,
            org_id: orgId,
            body: body.trim(),
          })
          .select()
          .single();

        if (msgError || !msgData) throw msgError;

        // Process file attachments if present
        if (files.length > 0) {
          for (const file of files) {
            const path = `${orgId}/${msgData.id}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage
              .from("comm-attachments")
              .upload(path, file);

            if (!uploadError) {
              const isImage = file.type.startsWith("image/");
              const isAudio = file.type.startsWith("audio/");
              const kind = isImage ? "image" : isAudio ? "audio" : "file";

              await supabase.from("message_attachments").insert({
                message_id: msgData.id,
                org_id: orgId,
                uploader_id: userId,
                filename: file.name,
                kind,
                storage_path: path,
                mime_type: file.type,
                size_bytes: file.size,
              });
            }
          }
        }

        // Process audio recording if present
        if (audio) {
          const path = `${orgId}/${msgData.id}/audio_${Date.now()}.${audio.ext}`;
          const { error: audioUploadError } = await supabase.storage
            .from("comm-attachments")
            .upload(path, audio.blob, { contentType: audio.mime });

          if (!audioUploadError) {
            await supabase.from("message_attachments").insert({
              message_id: msgData.id,
              org_id: orgId,
              uploader_id: userId,
              filename: `voice_message.${audio.ext}`,
              kind: "audio",
              storage_path: path,
              mime_type: audio.mime,
              size_bytes: audio.blob.size,
              duration_ms: audio.durationMs || null,
            });
          }
        }
      } finally {
        setSending(false);
      }
    },
    [orgId, userId, activeChannelId],
  );

  const deleteMessage = useCallback(async (msgId: string) => {
    await supabase.from("messages").delete().eq("id", msgId);
  }, []);

  return { sendMessage, deleteMessage, sending };
}
