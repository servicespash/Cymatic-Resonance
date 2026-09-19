CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid,
  assigned_by uuid,
  start_date date,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tasks_select_org' AND tablename = 'tasks') THEN
    CREATE POLICY "tasks_select_org" ON public.tasks FOR SELECT TO authenticated USING (org_id = public.current_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tasks_insert_admin' AND tablename = 'tasks') THEN
    CREATE POLICY "tasks_insert_admin" ON public.tasks FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tasks_update_admin_or_assignee' AND tablename = 'tasks') THEN
    CREATE POLICY "tasks_update_admin_or_assignee" ON public.tasks FOR UPDATE TO authenticated USING (org_id = public.current_org_id() AND (public.is_org_admin() OR assigned_to = auth.uid())) WITH CHECK (org_id = public.current_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tasks_delete_admin' AND tablename = 'tasks') THEN
    CREATE POLICY "tasks_delete_admin" ON public.tasks FOR DELETE TO authenticated USING (org_id = public.current_org_id() AND public.is_org_admin());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tasks_updated') THEN
    CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.download_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  format text NOT NULL,
  data_range_start date,
  data_range_end date,
  row_count integer NOT NULL DEFAULT 0,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'downloads_select_own_or_admin' AND tablename = 'download_history') THEN
    CREATE POLICY "downloads_select_own_or_admin" ON public.download_history FOR SELECT TO authenticated USING (org_id = public.current_org_id() AND (user_id = auth.uid() OR public.is_org_admin()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'downloads_insert_own' AND tablename = 'download_history') THEN
    CREATE POLICY "downloads_insert_own" ON public.download_history FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id() AND user_id = auth.uid());
  END IF;
END $$;

GRANT SELECT, INSERT ON public.download_history TO authenticated;
GRANT ALL ON public.download_history TO service_role;
ALTER TABLE public.download_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.join_call(_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _org uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT org_id INTO _org FROM public.profiles WHERE id = _uid;
  IF _org IS NULL THEN RAISE EXCEPTION 'no workspace'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.calls c WHERE c.id = _call_id AND c.org_id = _org) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.call_participants(call_id, user_id, state, joined_at)
  VALUES (_call_id, _uid, 'joined', now());

  UPDATE public.calls SET status = 'active' WHERE id = _call_id AND status = 'ringing';
END; $$;

REVOKE EXECUTE ON FUNCTION public.join_call(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_call(uuid) TO authenticated;