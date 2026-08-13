import { supabase } from "@/integrations/supabase/client";

export type AttachmentMetadata = {
  message_id: string;
  org_id: string;
  uploader_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  kind: "image" | "audio" | "file";
  filename: string;
  duration_ms?: number;
  width?: number;
  height?: number;
};

export async function uploadAttachment(
  file: File | Blob,
  orgId: string,
  channelId: string,
  messageId: string,
  filename: string,
) {
  // Enforce unique path: org/channel/message/uuid-filename
  const safeFilename = filename.replace(/[^\w.-]+/g, "_");
  const filePath = `${orgId}/${channelId}/${messageId}/${crypto.randomUUID()}-${safeFilename}`;

  const { error: uploadError } = await supabase.storage
    .from("comm-attachments")
    .upload(filePath, file, {
      contentType: (file as File).type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  return filePath;
}

export async function persistAttachmentMetadata(metadata: AttachmentMetadata) {
  const { data, error } = await supabase
    .from("message_attachments")
    .insert(metadata)
    .select()
    .single();

  if (error) throw error;
  return data;
}
