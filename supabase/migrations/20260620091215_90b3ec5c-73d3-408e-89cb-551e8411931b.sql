
DROP FUNCTION IF EXISTS public.create_org_as_admin(text, text);
DROP FUNCTION IF EXISTS public.join_org_with_code(text, text);

CREATE OR REPLACE FUNCTION public.create_org_as_admin(_name text, _org_type text)
 RETURNS TABLE(org_id uuid, org_name text, access_code text, org_type text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _code text;
  _org public.organizations%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  _code := public.gen_cym_code();
  INSERT INTO public.organizations(name, org_type, access_code, created_by)
  VALUES (_name, COALESCE(NULLIF(_org_type,''), 'generic'), _code, _uid)
  RETURNING * INTO _org;
  INSERT INTO public.profiles(id, role, org_id)
  VALUES (_uid, 'admin', _org.id)
  ON CONFLICT (id) DO UPDATE SET role = 'admin', org_id = _org.id;
  org_id := _org.id; org_name := _org.name;
  access_code := _org.access_code; org_type := _org.org_type;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_org_with_code(_code text, _category text)
 RETURNS TABLE(org_id uuid, org_name text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _org public.organizations%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _org FROM public.organizations WHERE access_code = upper(_code);
  IF _org.id IS NULL THEN RAISE EXCEPTION 'invalid access code'; END IF;
  INSERT INTO public.profiles(id, role, org_id, category)
  VALUES (_uid, 'member', _org.id, _category)
  ON CONFLICT (id) DO UPDATE SET role = 'member', org_id = _org.id, category = EXCLUDED.category;
  org_id := _org.id; org_name := _org.name;
  RETURN NEXT;
END;
$function$;
