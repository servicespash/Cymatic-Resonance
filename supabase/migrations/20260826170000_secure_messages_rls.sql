-- Secure messaging RLS
-- Drop permissive policies if they exist (hypothetically)
DROP POLICY IF EXISTS "Allow authenticated insert messages" ON public.messages;
DROP POLICY IF EXISTS "Allow authenticated select messages" ON public.messages;

-- Ensure these specific policies do not exist before attempting to create them
DROP POLICY IF EXISTS "org members insert messages" ON public.messages;
DROP POLICY IF EXISTS "org members select messages" ON public.messages;

-- Create secure policies
CREATE POLICY "org members insert messages" ON public.messages 
  FOR INSERT TO authenticated 
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY "org members select messages" ON public.messages 
  FOR SELECT TO authenticated 
  USING (org_id = public.current_org_id());

-- Reload schema
NOTIFY pgrst, 'reload schema';
