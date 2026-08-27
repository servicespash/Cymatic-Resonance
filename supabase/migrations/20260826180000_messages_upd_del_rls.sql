-- Add UPDATE and DELETE RLS policies for public.messages
DO $$
BEGIN
    -- Drop existing policies if they exist to avoid conflicts
    DROP POLICY IF EXISTS "org members update messages" ON public.messages;
    DROP POLICY IF EXISTS "org members delete messages" ON public.messages;
    
    -- Create the UPDATE policy
    CREATE POLICY "org members update messages" ON public.messages
      FOR UPDATE TO authenticated
      USING (org_id = public.current_org_id() AND sender_id = auth.uid())
      WITH CHECK (org_id = public.current_org_id() AND sender_id = auth.uid());

    -- Create the DELETE policy
    CREATE POLICY "org members delete messages" ON public.messages
      FOR DELETE TO authenticated
      USING (org_id = public.current_org_id() AND sender_id = auth.uid());
END $$;

-- Reload schema
NOTIFY pgrst, 'reload schema';
