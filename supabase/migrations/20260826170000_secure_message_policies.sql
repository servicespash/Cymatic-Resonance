-- Secure RLS policies for public.messages
DROP POLICY IF EXISTS "Allow authenticated insert messages" ON public.messages;
DROP POLICY IF EXISTS "Allow authenticated select messages" ON public.messages;

CREATE POLICY "Allow authenticated insert messages" ON public.messages 
  FOR INSERT TO authenticated 
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY "Allow authenticated select messages" ON public.messages 
  FOR SELECT TO authenticated 
  USING (org_id = public.current_org_id());
