CREATE TABLE IF NOT EXISTS public.task_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_activity_select" ON public.task_activity FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND (assignee_id = auth.uid() OR assigned_by = auth.uid())));
