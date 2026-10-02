DO $$
BEGIN
  IF to_regclass('public.tasks') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
  ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check
    CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'done'::text, 'archived'::text]));

  DROP POLICY IF EXISTS "tasks_update_org_members" ON public.tasks;

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
END $$;
