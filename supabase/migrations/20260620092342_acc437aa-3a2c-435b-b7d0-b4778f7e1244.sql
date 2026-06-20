
-- ============ Slice 2: Leave Requests ============
CREATE TYPE public.leave_type AS ENUM ('sick','vacation','personal','other');
CREATE TYPE public.leave_status AS ENUM ('pending','approved','denied');

CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type public.leave_type NOT NULL DEFAULT 'vacation',
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status public.leave_status NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_select_own_or_admin" ON public.leave_requests FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND (user_id = auth.uid() OR public.is_org_admin()));
CREATE POLICY "leave_insert_self" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND org_id = public.current_org_id());
CREATE POLICY "leave_update_admin" ON public.leave_requests FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());
CREATE POLICY "leave_delete_own_pending" ON public.leave_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

CREATE TRIGGER tg_leave_updated_at BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.request_leave(_type public.leave_type, _start date, _end date, _reason text)
RETURNS public.leave_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _org uuid; _row public.leave_requests%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT org_id INTO _org FROM public.profiles WHERE id = _uid;
  IF _org IS NULL THEN RAISE EXCEPTION 'no workspace'; END IF;
  IF _end < _start THEN RAISE EXCEPTION 'end before start'; END IF;
  INSERT INTO public.leave_requests(org_id, user_id, type, start_date, end_date, reason)
    VALUES (_org, _uid, _type, _start, _end, _reason) RETURNING * INTO _row;
  RETURN _row;
END; $$;

CREATE OR REPLACE FUNCTION public.decide_leave(_id uuid, _approved boolean)
RETURNS public.leave_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.leave_requests%ROWTYPE;
BEGIN
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'not admin'; END IF;
  UPDATE public.leave_requests
    SET status = CASE WHEN _approved THEN 'approved'::leave_status ELSE 'denied'::leave_status END,
        decided_by = auth.uid(), decided_at = now()
    WHERE id = _id AND org_id = public.current_org_id()
    RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  RETURN _row;
END; $$;

-- ============ Slice 3a: Brand columns ============
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS accent_color text;

CREATE OR REPLACE FUNCTION public.update_org_brand(_logo_url text, _accent_color text)
RETURNS public.organizations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.organizations%ROWTYPE;
BEGIN
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'not admin'; END IF;
  UPDATE public.organizations SET
    logo_url = COALESCE(_logo_url, logo_url),
    accent_color = COALESCE(NULLIF(_accent_color,''), accent_color),
    updated_at = now()
  WHERE id = public.current_org_id() RETURNING * INTO _row;
  RETURN _row;
END; $$;

-- ============ Slice 3b: Invites ============
CREATE TABLE public.org_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18),'hex'),
  category text,
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_invites TO authenticated;
GRANT SELECT ON public.org_invites TO anon;
GRANT ALL ON public.org_invites TO service_role;
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites_select_admin_or_by_token_anon" ON public.org_invites FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());
CREATE POLICY "invites_admin_write" ON public.org_invites FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());

CREATE OR REPLACE FUNCTION public.create_invite(_email text, _role public.app_role, _category text)
RETURNS public.org_invites LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.org_invites%ROWTYPE; _uid uuid := auth.uid(); _org uuid := public.current_org_id();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'not admin'; END IF;
  INSERT INTO public.org_invites(org_id, email, role, category, created_by)
    VALUES (_org, lower(_email), COALESCE(_role,'member'), _category, _uid)
    RETURNING * INTO _row;
  RETURN _row;
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_invite(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'not admin'; END IF;
  DELETE FROM public.org_invites WHERE id = _id AND org_id = public.current_org_id();
END; $$;

CREATE OR REPLACE FUNCTION public.accept_invite(_token text)
RETURNS TABLE(org_id uuid, org_name text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _inv public.org_invites%ROWTYPE; _org public.organizations%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _inv FROM public.org_invites WHERE token = _token;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'invalid invite'; END IF;
  IF _inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'already used'; END IF;
  IF _inv.expires_at < now() THEN RAISE EXCEPTION 'expired'; END IF;
  SELECT * INTO _org FROM public.organizations WHERE id = _inv.org_id;
  INSERT INTO public.profiles(id, role, org_id, category)
    VALUES (_uid, _inv.role, _inv.org_id, _inv.category)
    ON CONFLICT (id) DO UPDATE SET role = _inv.role, org_id = _inv.org_id, category = COALESCE(_inv.category, public.profiles.category);
  UPDATE public.org_invites SET accepted_at = now(), accepted_by = _uid WHERE id = _inv.id;
  org_id := _org.id; org_name := _org.name;
  RETURN NEXT;
END; $$;

-- Public RPC for unauthenticated invite preview (just name)
CREATE OR REPLACE FUNCTION public.invite_preview(_token text)
RETURNS TABLE(org_name text, email text, expires_at timestamptz, accepted boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT o.name, i.email, i.expires_at, (i.accepted_at IS NOT NULL)
    FROM public.org_invites i JOIN public.organizations o ON o.id = i.org_id
    WHERE i.token = _token;
END; $$;
GRANT EXECUTE ON FUNCTION public.invite_preview(text) TO anon, authenticated;
