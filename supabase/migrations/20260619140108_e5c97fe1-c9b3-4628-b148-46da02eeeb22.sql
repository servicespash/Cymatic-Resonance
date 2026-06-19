
CREATE OR REPLACE FUNCTION public.rotate_access_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := current_org_id(); _code text;
BEGIN
  IF NOT is_org_admin() THEN RAISE EXCEPTION 'not admin'; END IF;
  _code := gen_cym_code();
  UPDATE public.organizations SET access_code = _code, updated_at = now() WHERE id = _org;
  RETURN _code;
END; $$;

CREATE OR REPLACE FUNCTION public.set_member_role(_user uuid, _role app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := current_org_id();
BEGIN
  IF NOT is_org_admin() THEN RAISE EXCEPTION 'not admin'; END IF;
  UPDATE public.profiles SET role = _role WHERE id = _user AND org_id = _org;
END; $$;

CREATE OR REPLACE FUNCTION public.remove_member(_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := current_org_id();
BEGIN
  IF NOT is_org_admin() THEN RAISE EXCEPTION 'not admin'; END IF;
  IF _user = auth.uid() THEN RAISE EXCEPTION 'cannot remove self'; END IF;
  UPDATE public.profiles SET org_id = NULL, role = 'member' WHERE id = _user AND org_id = _org;
END; $$;

CREATE OR REPLACE FUNCTION public.update_org_settings(_name text, _org_type text, _cutoff time, _tz text)
RETURNS public.organizations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org public.organizations%ROWTYPE;
BEGIN
  IF NOT is_org_admin() THEN RAISE EXCEPTION 'not admin'; END IF;
  UPDATE public.organizations SET
    name = COALESCE(NULLIF(_name,''), name),
    org_type = COALESCE(NULLIF(_org_type,''), org_type),
    day_start_cutoff = COALESCE(_cutoff, day_start_cutoff),
    timezone = COALESCE(NULLIF(_tz,''), timezone),
    updated_at = now()
   WHERE id = current_org_id()
   RETURNING * INTO _org;
  RETURN _org;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_org()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := current_org_id();
BEGIN
  IF NOT is_org_admin() THEN RAISE EXCEPTION 'not admin'; END IF;
  UPDATE public.profiles SET org_id = NULL WHERE org_id = _org;
  DELETE FROM public.organizations WHERE id = _org;
END; $$;
