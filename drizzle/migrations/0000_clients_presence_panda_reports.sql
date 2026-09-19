-- 1. Client registry (workspace scoped)
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  company text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_own_org" ON public.clients
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

CREATE POLICY "clients_insert_own_org" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND created_by = auth.uid());

CREATE POLICY "clients_update_own_org" ON public.clients
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY "clients_delete_admin" ON public.clients
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());

CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Presence columns on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- 3. Panda Ping error reports (write-only from clients, admin readable)
CREATE TABLE IF NOT EXISTS public.panda_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue text NOT NULL,
  url text,
  user_agent text,
  console_trace jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.panda_reports TO service_role;

ALTER TABLE public.panda_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "panda_reports_admin_read" ON public.panda_reports
  FOR SELECT TO authenticated
  USING (public.is_org_admin());
