
-- message_attachments table
CREATE TABLE public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('image','audio','file')),
  filename text NOT NULL,
  duration_ms int,
  width int,
  height int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX message_attachments_message_idx ON public.message_attachments(message_id);
CREATE INDEX message_attachments_org_idx ON public.message_attachments(org_id);

GRANT SELECT, INSERT, DELETE ON public.message_attachments TO authenticated;
GRANT ALL ON public.message_attachments TO service_role;

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "att_select_org" ON public.message_attachments
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

CREATE POLICY "att_insert_own" ON public.message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND org_id = public.current_org_id()
    AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.sender_id = auth.uid())
  );

CREATE POLICY "att_delete_own_or_admin" ON public.message_attachments
  FOR DELETE TO authenticated
  USING (uploader_id = auth.uid() OR public.is_org_admin());

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_attachments;

-- Storage policies for comm-attachments bucket
-- Path format: {org_id}/{channel_id}/{message_id}/{filename}
CREATE POLICY "comm_att_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comm-attachments'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );

CREATE POLICY "comm_att_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comm-attachments'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
    AND owner = auth.uid()
  );

CREATE POLICY "comm_att_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'comm-attachments'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
    AND (owner = auth.uid() OR public.is_org_admin())
  );
