-- Add download_history table for compliance tracking of export actions
CREATE TABLE IF NOT EXISTS public.download_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  format text NOT NULL, -- 'csv', 'pdf', 'excel'
  data_range_start date,
  data_range_end date,
  row_count integer,
  scope text, -- 'all', 'selected'
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.download_history TO authenticated;
GRANT ALL ON public.download_history TO service_role;
ALTER TABLE public.download_history ENABLE ROW LEVEL SECURITY;

-- Allow users to view and log their own or org download histories
CREATE POLICY "download_history_insert_self" ON public.download_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND org_id = public.current_org_id());

CREATE POLICY "download_history_select_org" ON public.download_history FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

-- Reload schema
NOTIFY pgrst, 'reload schema';
