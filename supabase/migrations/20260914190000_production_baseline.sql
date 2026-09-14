-- ===== source: 20260614085042_643187ee-acec-425a-bde0-6b1ed0c4201d.sql =====
-- Drop legacy tables if exist

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'member');
CREATE TYPE public.channel_kind AS ENUM ('broadcast', 'dm');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- CYM code generator
CREATE OR REPLACE FUNCTION public.gen_cym_code()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE code TEXT;
BEGIN
  LOOP
    code := 'CYM-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.organizations WHERE access_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_type TEXT NOT NULL DEFAULT 'generic',
  access_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  position TEXT,
  category TEXT,
  role public.app_role NOT NULL DEFAULT 'member',
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
$$;

-- Profiles policies
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR org_id = public.current_org_id());
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Organizations policies
CREATE POLICY "orgs_member_select" ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_org_id() OR created_by = auth.uid());
CREATE POLICY "orgs_admin_insert" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "orgs_admin_update" ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (id = public.current_org_id() AND public.is_org_admin());

-- Allow CYM access code lookup during signup (anyone authenticated can verify a code)
CREATE POLICY "orgs_code_lookup" ON public.organizations FOR SELECT TO authenticated
  USING (true);

-- Attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'present',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, attendance_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_attendance_org_date ON public.attendance(org_id, attendance_date);

CREATE POLICY "attendance_org_select" ON public.attendance FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "attendance_self_insert" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND org_id = public.current_org_id());
CREATE POLICY "attendance_self_update" ON public.attendance FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Channels
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.channel_kind NOT NULL DEFAULT 'broadcast',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channels_org_select" ON public.channels FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "channels_admin_insert" ON public.channels FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND (public.is_org_admin() OR kind = 'dm'));

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_messages_channel_created ON public.messages(channel_id, created_at);

CREATE POLICY "messages_org_select" ON public.messages FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "messages_org_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND sender_id = auth.uid());

DO $pub$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END $pub$;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Signup trigger: create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, position)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'position'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== source: 20260615022424_22ace92d-943f-4e43-800d-b5a67d4f7b72.sql =====

-- Atomic admin workspace creation (runs as the calling user via SECURITY DEFINER, but checks auth.uid())
CREATE OR REPLACE FUNCTION public.create_org_as_admin(_name text, _org_type text)
RETURNS TABLE(id uuid, name text, access_code text, org_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _code text;
  _org public.organizations%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  _code := public.gen_cym_code();

  INSERT INTO public.organizations(name, org_type, access_code, created_by)
  VALUES (_name, COALESCE(NULLIF(_org_type,''), 'generic'), _code, _uid)
  RETURNING * INTO _org;

  -- ensure profile exists then promote
  INSERT INTO public.profiles(id, role, org_id)
  VALUES (_uid, 'admin', _org.id)
  ON CONFLICT (id) DO UPDATE SET role = 'admin', org_id = _org.id;

  RETURN QUERY SELECT _org.id, _org.name, _org.access_code, _org.org_type;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_org_as_admin(text, text) TO authenticated;

-- Member join via CYM code
CREATE OR REPLACE FUNCTION public.join_org_with_code(_code text, _category text)
RETURNS TABLE(id uuid, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _org public.organizations%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO _org FROM public.organizations WHERE access_code = upper(_code);
  IF _org.id IS NULL THEN
    RAISE EXCEPTION 'invalid access code';
  END IF;

  INSERT INTO public.profiles(id, role, org_id, category)
  VALUES (_uid, 'member', _org.id, _category)
  ON CONFLICT (id) DO UPDATE SET role = 'member', org_id = _org.id, category = EXCLUDED.category;

  RETURN QUERY SELECT _org.id, _org.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_org_with_code(text, text) TO authenticated;

-- ===== source: 20260619135738_f8cb98fc-35b7-4088-9cdd-ec47f53146cd.sql =====

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS checked_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS break_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_break_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_late boolean NOT NULL DEFAULT false;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS day_start_cutoff time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

CREATE OR REPLACE FUNCTION public.pulse_checkin(_note text DEFAULT NULL)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _org_id uuid;
  _cutoff time;
  _row public.attendance%ROWTYPE;
  _late boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT org_id INTO _org_id FROM public.profiles WHERE id = _uid;
  IF _org_id IS NULL THEN RAISE EXCEPTION 'no workspace'; END IF;
  SELECT day_start_cutoff INTO _cutoff FROM public.organizations WHERE id = _org_id;
  _late := (now() AT TIME ZONE 'UTC')::time > _cutoff;

  INSERT INTO public.attendance(user_id, org_id, status, note, is_late)
  VALUES (_uid, _org_id, 'present', _note, _late)
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.pulse_checkout(_id uuid)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.attendance%ROWTYPE;
BEGIN
  UPDATE public.attendance
     SET checked_out_at = now(),
         total_break_minutes = total_break_minutes
           + CASE WHEN break_started_at IS NOT NULL
                  THEN EXTRACT(EPOCH FROM (now() - break_started_at))::int / 60
                  ELSE 0 END,
         break_started_at = NULL
   WHERE id = _id AND user_id = auth.uid()
   RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.pulse_toggle_break(_id uuid)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.attendance%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.attendance WHERE id = _id AND user_id = auth.uid();
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;

  IF _row.break_started_at IS NULL THEN
    UPDATE public.attendance SET break_started_at = now() WHERE id = _id RETURNING * INTO _row;
  ELSE
    UPDATE public.attendance
       SET total_break_minutes = total_break_minutes
             + EXTRACT(EPOCH FROM (now() - break_started_at))::int / 60,
           break_started_at = NULL
     WHERE id = _id
     RETURNING * INTO _row;
  END IF;
  RETURN _row;
END;
$$;

-- ===== source: 20260619135943_8764ff9f-b40b-4084-8faf-eb45cba804be.sql =====

CREATE TABLE IF NOT EXISTS public.direct_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dm_pair_order CHECK (user_a < user_b),
  UNIQUE (org_id, user_a, user_b)
);
GRANT SELECT, INSERT, UPDATE ON public.direct_threads TO authenticated;
GRANT ALL ON public.direct_threads TO service_role;
ALTER TABLE public.direct_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY dt_select ON public.direct_threads FOR SELECT TO authenticated
  USING (org_id = current_org_id() AND (user_a = auth.uid() OR user_b = auth.uid()));

CREATE TABLE IF NOT EXISTS public.message_reads (
  user_id uuid NOT NULL,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reads TO authenticated;
GRANT ALL ON public.message_reads TO service_role;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY mr_self ON public.message_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY mre_select ON public.message_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.org_id = current_org_id()));
CREATE POLICY mre_insert ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.org_id = current_org_id()));
CREATE POLICY mre_delete ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DO $pub$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END $pub$;
DO $pub$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_threads; EXCEPTION WHEN duplicate_object THEN NULL; END $pub$;

CREATE OR REPLACE FUNCTION public.open_dm(_other uuid)
RETURNS public.direct_threads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _org uuid;
  _a uuid; _b uuid;
  _thread public.direct_threads%ROWTYPE;
  _channel public.channels%ROWTYPE;
  _name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _uid = _other THEN RAISE EXCEPTION 'cannot DM self'; END IF;
  SELECT org_id INTO _org FROM public.profiles WHERE id = _uid;
  IF _org IS NULL THEN RAISE EXCEPTION 'no workspace'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _other AND org_id = _org) THEN
    RAISE EXCEPTION 'not in workspace';
  END IF;

  IF _uid < _other THEN _a := _uid; _b := _other; ELSE _a := _other; _b := _uid; END IF;

  SELECT * INTO _thread FROM public.direct_threads WHERE org_id = _org AND user_a = _a AND user_b = _b;
  IF _thread.id IS NOT NULL THEN RETURN _thread; END IF;

  _name := 'dm:' || _a::text || ':' || _b::text;
  INSERT INTO public.channels(name, kind, org_id, created_by)
  VALUES (_name, 'dm', _org, _uid)
  RETURNING * INTO _channel;

  INSERT INTO public.direct_threads(org_id, channel_id, user_a, user_b)
  VALUES (_org, _channel.id, _a, _b)
  RETURNING * INTO _thread;

  RETURN _thread;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_reaction(_message uuid, _emoji text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _exists boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.message_reactions WHERE message_id = _message AND user_id = _uid AND emoji = _emoji) INTO _exists;
  IF _exists THEN
    DELETE FROM public.message_reactions WHERE message_id = _message AND user_id = _uid AND emoji = _emoji;
    RETURN false;
  ELSE
    INSERT INTO public.message_reactions(message_id, user_id, emoji) VALUES (_message, _uid, _emoji);
    RETURN true;
  END IF;
END;
$$;

-- Channels also need an UPDATE policy nope — only direct_threads need update for last_message_at; do it via trigger as system
CREATE OR REPLACE FUNCTION public.bump_dm_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.direct_threads SET last_message_at = NEW.created_at WHERE channel_id = NEW.channel_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS bump_dm_thread_trg ON public.messages;
CREATE TRIGGER bump_dm_thread_trg AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_dm_thread();

-- ===== source: 20260619140108_e5c97fe1-c9b3-4628-b148-46da02eeeb22.sql =====

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

-- ===== source: 20260620091215_90b3ec5c-73d3-408e-89cb-551e8411931b.sql =====

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

-- ===== source: 20260620092342_acc437aa-3a2c-435b-b7d0-b4778f7e1244.sql =====

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

-- ===== source: 20260620092449_e44b4911-82b8-40e7-9ee5-00b252acbac8.sql =====

CREATE POLICY "org_logos_select_member" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
);

CREATE POLICY "org_logos_admin_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
  AND public.is_org_admin()
);

CREATE POLICY "org_logos_admin_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
  AND public.is_org_admin()
);

CREATE POLICY "org_logos_admin_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
  AND public.is_org_admin()
);

-- ===== source: 20260621101609_a24a688a-307c-405a-b501-050aa8eceaf7.sql =====

-- message_attachments table
CREATE TABLE public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('image','audio','file')),
  filename text NOT NULL,
  duration_ms int,
  width int,
  height int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX message_attachments_message_idx ON public.message_attachments(message_id);
CREATE INDEX message_attachments_org_idx ON public.message_attachments(org_id);

GRANT SELECT, INSERT, DELETE ON public.message_attachments TO authenticated;
GRANT ALL ON public.message_attachments TO service_role;

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "att_select_org" ON public.message_attachments
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

CREATE POLICY "att_insert_own" ON public.message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND org_id = public.current_org_id()
    AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.sender_id = auth.uid())
  );

CREATE POLICY "att_delete_own_or_admin" ON public.message_attachments
  FOR DELETE TO authenticated
  USING (uploader_id = auth.uid() OR public.is_org_admin());

DO $pub$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.message_attachments; EXCEPTION WHEN duplicate_object THEN NULL; END $pub$;

-- Storage policies for comm-attachments bucket
-- Path format: {org_id}/{channel_id}/{message_id}/{filename}
CREATE POLICY "comm_att_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comm-attachments'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );

CREATE POLICY "comm_att_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comm-attachments'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
    AND owner = auth.uid()
  );

CREATE POLICY "comm_att_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'comm-attachments'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
    AND (owner = auth.uid() OR public.is_org_admin())
  );

-- ===== source: 20260622090457_760365cc-f983-4f10-9fe2-f480937a984f.sql =====
-- Calls + participants for live audio/video via WebRTC + Supabase Realtime signaling

CREATE TYPE public.call_kind AS ENUM ('audio', 'video');
CREATE TYPE public.call_status AS ENUM ('ringing', 'active', 'ended', 'missed', 'declined');
CREATE TYPE public.participant_state AS ENUM ('invited', 'joined', 'declined', 'left');

CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  initiator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.call_kind NOT NULL DEFAULT 'audio',
  status public.call_status NOT NULL DEFAULT 'ringing',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view calls" ON public.calls FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "org members create calls" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND initiator_id = auth.uid());
CREATE POLICY "participants update calls" ON public.calls FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

CREATE TABLE public.call_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state public.participant_state NOT NULL DEFAULT 'invited',
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (call_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_participants TO authenticated;
GRANT ALL ON public.call_participants TO service_role;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view participants" ON public.call_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calls c WHERE c.id = call_id AND c.org_id = public.current_org_id()));
CREATE POLICY "initiator invites participants" ON public.call_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.calls c WHERE c.id = call_id AND c.org_id = public.current_org_id()));
CREATE POLICY "self updates participant" ON public.call_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX calls_channel_idx ON public.calls(channel_id, created_at DESC);
CREATE INDEX calls_org_status_idx ON public.calls(org_id, status);
CREATE INDEX participants_call_idx ON public.call_participants(call_id);
CREATE INDEX participants_user_idx ON public.call_participants(user_id, state);

DO $pub$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.calls; EXCEPTION WHEN duplicate_object THEN NULL; END $pub$;
DO $pub$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants; EXCEPTION WHEN duplicate_object THEN NULL; END $pub$;
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER TABLE public.call_participants REPLICA IDENTITY FULL;

-- ===== source: 20260703223709_add_call_tables.sql =====
-- Corrected Migration for Live Schema Alignment
-- Drop incorrect/obsolete structures if they exist locally

-- Ensure required enums exist
DO $$ BEGIN
  CREATE TYPE public.call_kind AS ENUM ('audio', 'video');
  CREATE TYPE public.call_status AS ENUM ('ringing', 'active', 'ended', 'missed', 'declined');
  CREATE TYPE public.participant_state AS ENUM ('invited', 'joined', 'declined', 'left');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Re-create public.calls
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  initiator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.call_kind NOT NULL DEFAULT 'audio',
  status public.call_status NOT NULL DEFAULT 'ringing',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Re-create public.call_participants
CREATE TABLE IF NOT EXISTS public.call_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state public.participant_state NOT NULL DEFAULT 'invited',
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (call_id, user_id)
);

-- Ensure RLS and Grants
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_participants TO authenticated;

-- Policies (Re-adding to ensure consistency)
DROP POLICY IF EXISTS "org members view calls" ON public.calls;
CREATE POLICY "org members view calls" ON public.calls FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS "org members create calls" ON public.calls;
CREATE POLICY "org members create calls" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND initiator_id = auth.uid());

DROP POLICY IF EXISTS "participants update calls" ON public.calls;
CREATE POLICY "participants update calls" ON public.calls FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS "org members view participants" ON public.call_participants;
CREATE POLICY "org members view participants" ON public.call_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calls c WHERE c.id = call_id AND c.org_id = public.current_org_id()));

DROP POLICY IF EXISTS "initiator invites participants" ON public.call_participants;
CREATE POLICY "initiator invites participants" ON public.call_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.calls c WHERE c.id = call_id AND c.org_id = public.current_org_id()));

DROP POLICY IF EXISTS "self updates participant" ON public.call_participants;
CREATE POLICY "self updates participant" ON public.call_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS calls_channel_idx ON public.calls(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS calls_org_status_idx ON public.calls(org_id, status);
CREATE INDEX IF NOT EXISTS participants_call_idx ON public.call_participants(call_id);
CREATE INDEX IF NOT EXISTS participants_user_idx ON public.call_participants(user_id, state);

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'call_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;
  END IF;
END
$$;
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER TABLE public.call_participants REPLICA IDENTITY FULL;

-- ===== source: 20260712023123_e9fa47d5-9131-4508-9597-5d15f01e51c0.sql =====

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

-- ===== source: 20260712023152_9d63b063-1d74-4d0f-9d2f-23a6752323ca.sql =====

DROP POLICY IF EXISTS attendance_self_update ON public.attendance;

-- Members may only edit note on their own rows. Break toggling and checkout
-- happen through SECURITY DEFINER RPCs (pulse_toggle_break, pulse_checkout).
CREATE POLICY attendance_self_update_note ON public.attendance
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND checked_in_at    IS NOT DISTINCT FROM (SELECT checked_in_at    FROM public.attendance a WHERE a.id = attendance.id)
    AND checked_out_at   IS NOT DISTINCT FROM (SELECT checked_out_at   FROM public.attendance a WHERE a.id = attendance.id)
    AND break_started_at IS NOT DISTINCT FROM (SELECT break_started_at FROM public.attendance a WHERE a.id = attendance.id)
    AND total_break_minutes = (SELECT total_break_minutes FROM public.attendance a WHERE a.id = attendance.id)
    AND is_late          IS NOT DISTINCT FROM (SELECT is_late          FROM public.attendance a WHERE a.id = attendance.id)
    AND status           IS NOT DISTINCT FROM (SELECT status           FROM public.attendance a WHERE a.id = attendance.id)
    AND user_id          = (SELECT user_id          FROM public.attendance a WHERE a.id = attendance.id)
    AND org_id           = (SELECT org_id           FROM public.attendance a WHERE a.id = attendance.id)
    AND attendance_date  = (SELECT attendance_date  FROM public.attendance a WHERE a.id = attendance.id)
  );

-- ===== source: 20260714030326_1f10d7c6-f5dd-4a16-b2e3-71145ab8959e.sql =====

-- 1. toggle_reaction: add cross-org guard
CREATE OR REPLACE FUNCTION public.toggle_reaction(_message uuid, _emoji text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _exists boolean; _caller_org uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT org_id INTO _caller_org FROM public.profiles WHERE id = _uid;
  IF _caller_org IS NULL THEN RAISE EXCEPTION 'no workspace'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = _message AND m.org_id = _caller_org
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.message_reactions WHERE message_id = _message AND user_id = _uid AND emoji = _emoji) INTO _exists;
  IF _exists THEN
    DELETE FROM public.message_reactions WHERE message_id = _message AND user_id = _uid AND emoji = _emoji;
    RETURN false;
  ELSE
    INSERT INTO public.message_reactions(message_id, user_id, emoji) VALUES (_message, _uid, _emoji);
    RETURN true;
  END IF;
END;
$function$;

-- 2. call_participants: only initiator can invite others (self can still self-join via 'self updates participant')
DROP POLICY IF EXISTS "initiator invites participants" ON public.call_participants;
CREATE POLICY "initiator invites participants"
  ON public.call_participants FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calls c
      WHERE c.id = call_participants.call_id
        AND c.org_id = public.current_org_id()
        AND (
          c.initiator_id = auth.uid()
          OR call_participants.user_id = auth.uid()
        )
    )
  );

-- 3. calls UPDATE policy: restrict to initiator or active participants
DROP POLICY IF EXISTS "participants update calls" ON public.calls;
CREATE POLICY "participants update calls"
  ON public.calls FOR UPDATE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (
      initiator_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.call_participants cp
        WHERE cp.call_id = calls.id AND cp.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    org_id = public.current_org_id()
    AND (
      initiator_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.call_participants cp
        WHERE cp.call_id = calls.id AND cp.user_id = auth.uid()
      )
    )
  );

-- 4. Revoke EXECUTE from PUBLIC/anon on SECURITY DEFINER functions, then grant back where needed.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_group() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_dm_thread() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.lookup_org_by_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invite_preview(text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.accept_invite(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_org_as_admin(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_org_with_code(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_invite(text, app_role, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_invite(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_org_settings(text, text, time, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_org_brand(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_org() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rotate_access_code() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_leave(leave_type, date, date, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decide_leave(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pulse_checkin(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pulse_checkout(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pulse_toggle_break(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.toggle_reaction(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.open_dm(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gen_cym_code() FROM PUBLIC, anon, authenticated;

-- Ensure needed grants exist
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_org_by_code(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.invite_preview(text) TO authenticated, anon;

-- ===== source: 20260812000000_add_call_signals_and_chat_management.sql =====
-- Call signals
CREATE TABLE IF NOT EXISTS public.call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  from_uid uuid NOT NULL REFERENCES auth.users(id),
  to_uid uuid REFERENCES auth.users(id),
  type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_signals_call_idx ON public.call_signals(call_id, created_at);
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants read signals" ON public.call_signals;
CREATE POLICY "participants read signals" ON public.call_signals FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.call_participants cp WHERE cp.call_id = call_signals.call_id AND cp.user_id = auth.uid()));

DROP POLICY IF EXISTS "participants insert signals" ON public.call_signals;
CREATE POLICY "participants insert signals" ON public.call_signals FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.call_participants cp WHERE cp.call_id = call_signals.call_id AND cp.user_id = auth.uid()));

-- Chat management
ALTER TABLE public.direct_threads ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.direct_threads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ===== source: 20260826120000_cleanup_redundant_bucket.sql =====
-- Cleanup redundant storage bucket
-- This migration was originally intended to remove the 'comm_attachments' bucket.
-- Due to Supabase storage protection, direct deletion via SQL is blocked.
-- This migration is now a no-op to preserve migration history while preventing deployment failures.

DO $$
BEGIN
  -- No-op: Direct deletion via SQL is not allowed for storage buckets.
  -- If bucket removal is required, it must be performed via the Supabase Storage API,
  -- not via direct SQL migration.
  RAISE NOTICE 'Skipping cleanup of comm_attachments bucket: direct SQL deletion is not permitted.';
END $$;

-- ===== source: 20260826130000_add_missing_tables_to_realtime.sql =====
-- Robustly add tables to supabase_realtime publication
DO $$
DECLARE
  _table text;
BEGIN
  FOREACH _table IN ARRAY ARRAY['tasks', 'profiles', 'leave_requests']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', _table);
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Table % already in publication, skipping', _table;
      WHEN undefined_table THEN
        RAISE NOTICE 'Table % does not exist, skipping', _table;
    END;
  END LOOP;
END
$$;
NOTIFY pgrst, 'reload schema';

-- ===== source: 20260826140000_reconcile_comms_rls.sql =====
-- Reconcile Communication and DM Policies
-- 1. Ensure Admins have full access to manage records
-- 2. Allow users to hard-delete their own messages
-- 3. Maintain soft-delete capability via UPDATE

-- MESSAGES
DO $$
BEGIN
    -- Drop old policies to replace with comprehensive ones
    DROP POLICY IF EXISTS "messages_soft_delete_sender" ON public.messages;
    DROP POLICY IF EXISTS "messages_delete_admin" ON public.messages;
    DROP POLICY IF EXISTS "messages_delete_sender" ON public.messages;
    DROP POLICY IF EXISTS "messages_admin_all" ON public.messages;
END $$;

-- Policy for users to hard delete their own messages
CREATE POLICY "messages_delete_sender" ON public.messages
    FOR DELETE
    TO authenticated
    USING (sender_id = auth.uid());

-- Policy for admins to manage all messages in their org
CREATE POLICY "messages_admin_all" ON public.messages
    FOR ALL
    TO authenticated
    USING (is_org_admin() AND org_id = current_org_id())
    WITH CHECK (is_org_admin() AND org_id = current_org_id());

-- Ensure soft delete UPDATE policy exists and is robust
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'messages_update_sender' AND tablename = 'messages') THEN
        CREATE POLICY "messages_update_sender" ON public.messages
            FOR UPDATE
            TO authenticated
            USING (sender_id = auth.uid())
            WITH CHECK (sender_id = auth.uid());
    END IF;
END $$;


-- CHANNELS
DO $$
BEGIN
    DROP POLICY IF EXISTS "channels_admin_all" ON public.channels;
END $$;

CREATE POLICY "channels_admin_all" ON public.channels
    FOR ALL
    TO authenticated
    USING (is_org_admin() AND org_id = current_org_id())
    WITH CHECK (is_org_admin() AND org_id = current_org_id());


-- DIRECT THREADS
DO $$
BEGIN
    DROP POLICY IF EXISTS "direct_threads_admin_all" ON public.direct_threads;
END $$;

CREATE POLICY "direct_threads_admin_all" ON public.direct_threads
    FOR ALL
    TO authenticated
    USING (is_org_admin() AND org_id = current_org_id())
    WITH CHECK (is_org_admin() AND org_id = current_org_id());

-- Ensure realtime is enabled for these tables (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'channels'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'direct_threads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_threads;
    END IF;
END $$;

-- ===== source: 20260826150000_reconcile_tasks_schema.sql =====
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

-- ===== source: 20260826160000_fix_rpc_permissions.sql =====
-- Fix RPC permission denied errors and task schema mismatches
-- Grant EXECUTE permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_org_settings(text, text, time, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_org_brand(text, text) TO authenticated;

-- Ensure tasks table has task_kind column
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_kind text DEFAULT 'general';

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';

-- ===== source: 20260826170000_consolidated_message_policies.sql =====
-- Consolidate and secure all policies for public.messages
DO $$
BEGIN
    -- Drop all potentially conflicting policies
    DROP POLICY IF EXISTS "Allow authenticated insert messages" ON public.messages;
    DROP POLICY IF EXISTS "Allow authenticated select messages" ON public.messages;
    DROP POLICY IF EXISTS "messages_insert_active" ON public.messages;
    DROP POLICY IF EXISTS "messages_select_active" ON public.messages;
    DROP POLICY IF EXISTS "messages_update_sender" ON public.messages;
    DROP POLICY IF EXISTS "messages_delete_sender" ON public.messages;
    DROP POLICY IF EXISTS "messages_admin_all" ON public.messages;
    DROP POLICY IF EXISTS "org members insert messages" ON public.messages;
    DROP POLICY IF EXISTS "org members select messages" ON public.messages;
    DROP POLICY IF EXISTS "org members update messages" ON public.messages;
    DROP POLICY IF EXISTS "org members delete messages" ON public.messages;
END $$;

-- Create secure, unified policies
CREATE POLICY "org members insert messages" ON public.messages 
  FOR INSERT TO authenticated 
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY "org members select messages" ON public.messages 
  FOR SELECT TO authenticated 
  USING (org_id = public.current_org_id());

CREATE POLICY "org members update messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND sender_id = auth.uid())
  WITH CHECK (org_id = public.current_org_id() AND sender_id = auth.uid());

CREATE POLICY "org members delete messages" ON public.messages
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND sender_id = auth.uid());

-- Reload schema
NOTIFY pgrst, 'reload schema';

-- ===== source: 20260826180000_messages_upd_del_rls.sql =====
-- Add UPDATE and DELETE RLS policies for public.messages
DO $$
BEGIN
    -- Drop existing policies if they exist to avoid conflicts
    DROP POLICY IF EXISTS "org members update messages" ON public.messages;
    DROP POLICY IF EXISTS "org members delete messages" ON public.messages;
    
    -- Create the UPDATE policy
    CREATE POLICY "org members update messages" ON public.messages
      FOR UPDATE TO authenticated
      USING (org_id = public.current_org_id() AND sender_id = auth.uid())
      WITH CHECK (org_id = public.current_org_id() AND sender_id = auth.uid());

    -- Create the DELETE policy
    CREATE POLICY "org members delete messages" ON public.messages
      FOR DELETE TO authenticated
      USING (org_id = public.current_org_id() AND sender_id = auth.uid());
END $$;

-- Reload schema
NOTIFY pgrst, 'reload schema';

-- ===== source: 20260826190000_consolidated_message_policies.sql =====
-- Consolidate and secure all policies for public.messages
DO $$
BEGIN
    -- Drop old policies to replace with comprehensive ones
    DROP POLICY IF EXISTS "Allow authenticated insert messages" ON public.messages;
    DROP POLICY IF EXISTS "Allow authenticated select messages" ON public.messages;
    DROP POLICY IF EXISTS "messages_insert_active" ON public.messages;
    DROP POLICY IF EXISTS "messages_select_active" ON public.messages;
    DROP POLICY IF EXISTS "messages_update_sender" ON public.messages;
    DROP POLICY IF EXISTS "messages_delete_sender" ON public.messages;
    DROP POLICY IF EXISTS "messages_admin_all" ON public.messages;
END $$;

-- Re-create secure, unified policies only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org members insert messages' AND tablename = 'messages') THEN
        CREATE POLICY "org members insert messages" ON public.messages 
          FOR INSERT TO authenticated 
          WITH CHECK (org_id = public.current_org_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org members select messages' AND tablename = 'messages') THEN
        CREATE POLICY "org members select messages" ON public.messages 
          FOR SELECT TO authenticated 
          USING (org_id = public.current_org_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org members update messages' AND tablename = 'messages') THEN
        CREATE POLICY "org members update messages" ON public.messages
          FOR UPDATE TO authenticated
          USING (org_id = public.current_org_id() AND sender_id = auth.uid())
          WITH CHECK (org_id = public.current_org_id() AND sender_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org members delete messages' AND tablename = 'messages') THEN
        CREATE POLICY "org members delete messages" ON public.messages
          FOR DELETE TO authenticated
          USING (org_id = public.current_org_id() AND sender_id = auth.uid());
    END IF;
END $$;

-- Reload schema
NOTIFY pgrst, 'reload schema';

-- ===== source: 20260827150200_add_download_history.sql =====
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
DROP POLICY IF EXISTS "download_history_insert_self" ON public.download_history;
CREATE POLICY "download_history_insert_self" ON public.download_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND org_id = public.current_org_id());

DROP POLICY IF EXISTS "download_history_select_org" ON public.download_history;
CREATE POLICY "download_history_select_org" ON public.download_history FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

-- Reload schema
NOTIFY pgrst, 'reload schema';

-- ===== source: 20260830100000_add_tasks_and_join_call.sql =====
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title text NOT NULL,
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    start_date timestamp with time zone,
    due_date timestamp with time zone,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Policies for tasks
CREATE POLICY "Users can view tasks in their org" ON public.tasks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.org_id = tasks.org_id
        )
    );

CREATE POLICY "Users can insert tasks in their org" ON public.tasks
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.org_id = tasks.org_id
        )
    );

CREATE POLICY "Users can update tasks in their org" ON public.tasks
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.org_id = tasks.org_id
        )
    );

CREATE POLICY "Users can delete tasks in their org" ON public.tasks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.org_id = tasks.org_id
        )
    );

-- join_call RPC
CREATE OR REPLACE FUNCTION public.join_call(_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.call_participants (call_id, user_id, state, joined_at)
    VALUES (_call_id, auth.uid(), 'joined', now())
    ON CONFLICT (call_id, user_id) 
    DO UPDATE SET 
        state = 'joined',
        joined_at = now(),
        left_at = NULL;
END;
$$;

-- ===== source: 20260830112000_optimize_security_and_performance.sql =====
-- 1. Security Fixes: Fix join_call security
ALTER FUNCTION public.join_call(uuid) SET search_path = public, auth;

-- 2. Performance Fixes: Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_tasks_org_id ON public.tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON public.tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_call_id ON public.call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_user_id ON public.call_participants(user_id);

-- 3. RLS Optimization: Consolidate tasks policies
DROP POLICY IF EXISTS "Users can view tasks in their org" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert tasks in their org" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks in their org" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their org" ON public.tasks;

CREATE POLICY "Users can manage tasks in their org" ON public.tasks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.org_id = tasks.org_id
        )
    );

-- ===== source: 20260903052603_5485c1f0-a9f7-4a10-8d08-bc8f8da486dd.sql =====
CREATE TABLE public.tasks (
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_org" ON public.tasks FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "tasks_insert_admin" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_admin());
CREATE POLICY "tasks_update_admin_or_assignee" ON public.tasks FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND (public.is_org_admin() OR assigned_to = auth.uid()))
  WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "tasks_delete_admin" ON public.tasks FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());

CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.download_history (
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

GRANT SELECT, INSERT ON public.download_history TO authenticated;
GRANT ALL ON public.download_history TO service_role;
ALTER TABLE public.download_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "downloads_select_own_or_admin" ON public.download_history FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND (user_id = auth.uid() OR public.is_org_admin()));
CREATE POLICY "downloads_insert_own" ON public.download_history FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND user_id = auth.uid());

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

-- ===== source: 20260903060000_add_policies_to_self_rush_sessions.sql =====
ALTER TABLE public.self_rush_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self_rush_sessions_select_own" ON public.self_rush_sessions FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND profile_id = auth.uid());
CREATE POLICY "self_rush_sessions_insert_own" ON public.self_rush_sessions FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND profile_id = auth.uid());

-- ===== source: 20260903070000_add_missing_rls_policies.sql =====
-- Add missing RLS policies for communication tables

-- 1. Channels: Add INSERT, UPDATE, DELETE
-- Assuming org_id check as per channels_admin_all
CREATE POLICY "channels_insert" ON "public"."channels"
    FOR INSERT TO "authenticated"
    WITH CHECK (is_org_admin() AND (org_id = current_org_id()));

CREATE POLICY "channels_update" ON "public"."channels"
    FOR UPDATE TO "authenticated"
    USING (is_org_admin() AND (org_id = current_org_id()))
    WITH CHECK (is_org_admin() AND (org_id = current_org_id()));

CREATE POLICY "channels_delete" ON "public"."channels"
    FOR DELETE TO "authenticated"
    USING (is_org_admin() AND (org_id = current_org_id()));

-- 2. Call Signals: Add UPDATE, DELETE
-- Assuming participant check as per existing insert/select
CREATE POLICY "participants_update_signals" ON "public"."call_signals"
    FOR UPDATE TO "authenticated"
    USING (EXISTS (SELECT 1 FROM call_participants cp WHERE cp.call_id = call_signals.call_id AND cp.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM call_participants cp WHERE cp.call_id = call_signals.call_id AND cp.user_id = auth.uid()));

CREATE POLICY "participants_delete_signals" ON "public"."call_signals"
    FOR DELETE TO "authenticated"
    USING (EXISTS (SELECT 1 FROM call_participants cp WHERE cp.call_id = call_signals.call_id AND cp.user_id = auth.uid()));

