-- 1. Attachments table for task files
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for task_attachments
-- Users can only view/insert attachments for tasks assigned to them
CREATE POLICY "task_attachments_select" ON public.task_attachments FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND (assignee_id = auth.uid() OR assigned_by = auth.uid())));

CREATE POLICY "task_attachments_insert" ON public.task_attachments FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND assignee_id = auth.uid()));

-- 4. Ensure Tasks RLS Policies are correct
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
    USING (org_id = public.current_org_id() AND (assignee_id = auth.uid() OR assigned_by = auth.uid()));

DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
    USING (org_id = public.current_org_id() AND assignee_id = auth.uid());
