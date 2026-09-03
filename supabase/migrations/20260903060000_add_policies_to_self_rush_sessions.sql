ALTER TABLE public.self_rush_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self_rush_sessions_select_own" ON public.self_rush_sessions FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND profile_id = auth.uid());
CREATE POLICY "self_rush_sessions_insert_own" ON public.self_rush_sessions FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND profile_id = auth.uid());
