-- Consolidate and secure all policies for public.messages
DO $$
BEGIN
    -- Drop old policies if they exist to start clean
    DROP POLICY IF EXISTS "Allow authenticated insert messages" ON public.messages;
    DROP POLICY IF EXISTS "Allow authenticated select messages" ON public.messages;
    DROP POLICY IF EXISTS "org members insert messages" ON public.messages;
    DROP POLICY IF EXISTS "org members select messages" ON public.messages;
    DROP POLICY IF EXISTS "org members update messages" ON public.messages;
    DROP POLICY IF EXISTS "org members delete messages" ON public.messages;
END $$;

-- Create secure, unified policies
CREATE POLICY "org members insert messages" ON public.messages 
  FOR INSERT TO authenticated 
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY "org members select messages" ON public.messages 
  FOR SELECT TO authenticated 
  USING (org_id = public.current_org_id());

CREATE POLICY "org members update messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND sender_id = auth.uid())
  WITH CHECK (org_id = public.current_org_id() AND sender_id = auth.uid());

CREATE POLICY "org members delete messages" ON public.messages
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND sender_id = auth.uid());

-- Reload schema
NOTIFY pgrst, 'reload schema';
