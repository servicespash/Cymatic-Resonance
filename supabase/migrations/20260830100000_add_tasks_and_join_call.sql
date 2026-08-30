CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title text NOT NULL,
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    start_date timestamp with time zone,
    due_date timestamp with time zone,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Policies for tasks
CREATE POLICY "Users can view tasks in their org" ON public.tasks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.org_id = tasks.org_id
        )
    );

CREATE POLICY "Users can insert tasks in their org" ON public.tasks
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.org_id = tasks.org_id
        )
    );

CREATE POLICY "Users can update tasks in their org" ON public.tasks
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.org_id = tasks.org_id
        )
    );

CREATE POLICY "Users can delete tasks in their org" ON public.tasks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.org_id = tasks.org_id
        )
    );

-- join_call RPC
CREATE OR REPLACE FUNCTION public.join_call(_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.call_participants (call_id, user_id, state, joined_at)
    VALUES (_call_id, auth.uid(), 'joined', now())
    ON CONFLICT (call_id, user_id) 
    DO UPDATE SET 
        state = 'joined',
        joined_at = now(),
        left_at = NULL;
END;
$$;
