-- Consolidate and secure all policies for public.messages
DO $$
BEGIN
    -- Drop old policies to replace with comprehensive ones
    DROP POLICY IF EXISTS "Allow authenticated insert messages" ON public.messages;
    DROP POLICY IF EXISTS "Allow authenticated select messages" ON public.messages;
    DROP POLICY IF EXISTS "messages_insert_active" ON public.messages;
    DROP POLICY IF EXISTS "messages_select_active" ON public.messages;
    DROP POLICY IF EXISTS "messages_update_sender" ON public.messages;
    DROP POLICY IF EXISTS "messages_delete_sender" ON public.messages;
    DROP POLICY IF EXISTS "messages_admin_all" ON public.messages;
END $$;

-- Re-create secure, unified policies only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org members insert messages' AND tablename = 'messages') THEN
        CREATE POLICY "org members insert messages" ON public.messages 
          FOR INSERT TO authenticated 
          WITH CHECK (org_id = public.current_org_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org members select messages' AND tablename = 'messages') THEN
        CREATE POLICY "org members select messages" ON public.messages 
          FOR SELECT TO authenticated 
          USING (org_id = public.current_org_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org members update messages' AND tablename = 'messages') THEN
        CREATE POLICY "org members update messages" ON public.messages
          FOR UPDATE TO authenticated
          USING (org_id = public.current_org_id() AND sender_id = auth.uid())
          WITH CHECK (org_id = public.current_org_id() AND sender_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org members delete messages' AND tablename = 'messages') THEN
        CREATE POLICY "org members delete messages" ON public.messages
          FOR DELETE TO authenticated
          USING (org_id = public.current_org_id() AND sender_id = auth.uid());
    END IF;
END $$;

-- Reload schema
NOTIFY pgrst, 'reload schema';
