-- Add UPDATE and DELETE RLS policies for public.messages
CREATE POLICY IF NOT EXISTS "org members update messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND sender_id = auth.uid())
  WITH CHECK (org_id = public.current_org_id() AND sender_id = auth.uid());

CREATE POLICY IF NOT EXISTS "org members delete messages" ON public.messages
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND sender_id = auth.uid());

-- Reload schema
NOTIFY pgrst, 'reload schema';
