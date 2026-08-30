-- 1. Security Fixes: Fix join_call security
ALTER FUNCTION public.join_call(uuid) SET search_path = public, auth;

-- 2. Performance Fixes: Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_tasks_org_id ON public.tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON public.tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_call_id ON public.call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_user_id ON public.call_participants(user_id);

-- 3. RLS Optimization: Consolidate tasks policies
DROP POLICY IF EXISTS "Users can view tasks in their org" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert tasks in their org" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks in their org" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their org" ON public.tasks;

CREATE POLICY "Users can manage tasks in their org" ON public.tasks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.org_id = tasks.org_id
        )
    );
