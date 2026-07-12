
-- 1) Organizations: drop overly permissive read policy
DROP POLICY IF EXISTS orgs_code_lookup ON public.organizations;

-- Keep members' read via existing membership policy (assumed present).
-- Add a narrow, safe lookup RPC that returns only name (no access_code) for a specific code.
CREATE OR REPLACE FUNCTION public.lookup_org_by_code(_code text)
RETURNS TABLE(id uuid, name text, org_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, org_type FROM public.organizations WHERE access_code = upper(_code)
$$;
REVOKE ALL ON FUNCTION public.lookup_org_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_org_by_code(text) TO authenticated;

-- 2) Profiles: prevent role / org_id self-escalation
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND org_id IS NOT DISTINCT FROM (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

-- 3) accept_invite: require email match
CREATE OR REPLACE FUNCTION public.accept_invite(_token text)
RETURNS TABLE(org_id uuid, org_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _inv public.org_invites%ROWTYPE;
  _org public.organizations%ROWTYPE;
  _email text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT lower(coalesce(email, '')) INTO _email FROM auth.users WHERE id = _uid;
  SELECT * INTO _inv FROM public.org_invites WHERE token = _token;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'invalid invite'; END IF;
  IF _inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'already used'; END IF;
  IF _inv.expires_at < now() THEN RAISE EXCEPTION 'expired'; END IF;
  IF lower(_inv.email) <> _email THEN RAISE EXCEPTION 'invite email mismatch'; END IF;
  SELECT * INTO _org FROM public.organizations WHERE id = _inv.org_id;
  INSERT INTO public.profiles(id, role, org_id, category)
    VALUES (_uid, _inv.role, _inv.org_id, _inv.category)
    ON CONFLICT (id) DO UPDATE SET role = _inv.role, org_id = _inv.org_id, category = COALESCE(_inv.category, public.profiles.category);
  UPDATE public.org_invites SET accepted_at = now(), accepted_by = _uid WHERE id = _inv.id;
  org_id := _org.id; org_name := _org.name;
  RETURN NEXT;
END; $$;
