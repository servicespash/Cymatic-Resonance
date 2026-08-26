-- Reconciliation of Tasks Schema and Policies
-- 1. Ensure status enum parity (add 'archived')
-- 2. Ensure robust RLS policies for admin management

-- 1. Alter status check constraint to include 'archived'
-- Postgres doesn't easily allow altering enum/check constraints. 
-- We drop and recreate.
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'done'::text, 'archived'::text]));

-- 2. Update RLS policies for granular control
-- We need to ensure that admins/assigners can fully manage tasks.

DO $$
BEGIN
    DROP POLICY IF EXISTS "tasks_update_org_members" ON public.tasks;
END $$;

CREATE POLICY "tasks_update_admins_assigners" ON public.tasks
    FOR UPDATE
    TO authenticated
    USING (
        org_id = current_org_id() 
        AND (is_org_admin() OR assigned_by = auth.uid())
    )
    WITH CHECK (
        org_id = current_org_id() 
        AND (is_org_admin() OR assigned_by = auth.uid())
    );
