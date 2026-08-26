-- Reconcile Communication and DM Policies
-- 1. Ensure Admins have full access to manage records
-- 2. Allow users to hard-delete their own messages
-- 3. Maintain soft-delete capability via UPDATE

-- MESSAGES
DO $$
BEGIN
    -- Drop old policies to replace with comprehensive ones
    DROP POLICY IF EXISTS "messages_soft_delete_sender" ON public.messages;
    DROP POLICY IF EXISTS "messages_delete_admin" ON public.messages;
    DROP POLICY IF EXISTS "messages_delete_sender" ON public.messages;
    DROP POLICY IF EXISTS "messages_admin_all" ON public.messages;
END $$;

-- Policy for users to hard delete their own messages
CREATE POLICY "messages_delete_sender" ON public.messages
    FOR DELETE
    TO authenticated
    USING (sender_id = auth.uid());

-- Policy for admins to manage all messages in their org
CREATE POLICY "messages_admin_all" ON public.messages
    FOR ALL
    TO authenticated
    USING (is_org_admin() AND org_id = current_org_id())
    WITH CHECK (is_org_admin() AND org_id = current_org_id());

-- Ensure soft delete UPDATE policy exists and is robust
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'messages_update_sender' AND tablename = 'messages') THEN
        CREATE POLICY "messages_update_sender" ON public.messages
            FOR UPDATE
            TO authenticated
            USING (sender_id = auth.uid())
            WITH CHECK (sender_id = auth.uid());
    END IF;
END $$;


-- CHANNELS
DO $$
BEGIN
    DROP POLICY IF EXISTS "channels_admin_all" ON public.channels;
END $$;

CREATE POLICY "channels_admin_all" ON public.channels
    FOR ALL
    TO authenticated
    USING (is_org_admin() AND org_id = current_org_id())
    WITH CHECK (is_org_admin() AND org_id = current_org_id());


-- DIRECT THREADS
DO $$
BEGIN
    DROP POLICY IF EXISTS "direct_threads_admin_all" ON public.direct_threads;
END $$;

CREATE POLICY "direct_threads_admin_all" ON public.direct_threads
    FOR ALL
    TO authenticated
    USING (is_org_admin() AND org_id = current_org_id())
    WITH CHECK (is_org_admin() AND org_id = current_org_id());

-- Ensure realtime is enabled for these tables (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'channels'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'direct_threads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_threads;
    END IF;
END $$;
