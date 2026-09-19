-- ==========================================
-- Cymatic Resonance Production Baseline
-- Consolidated Schema Migration (v2)
-- ==========================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.channel_kind AS ENUM ('broadcast', 'dm');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.leave_type AS ENUM ('sick', 'vacation', 'personal', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'denied');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.call_kind AS ENUM ('audio', 'video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.call_status AS ENUM ('ringing', 'active', 'ended', 'missed', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.participant_state AS ENUM ('invited', 'joined', 'declined', 'left');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. UTILITY FUNCTIONS
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

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

-- 4. TABLES

-- Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_type TEXT NOT NULL DEFAULT 'generic',
  access_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  logo_url TEXT,
  accent_color TEXT,
  day_start_cutoff TIME NOT NULL DEFAULT '09:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  position TEXT,
  category TEXT,
  role public.app_role NOT NULL DEFAULT 'member',
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_at TIMESTAMPTZ,
  break_started_at TIMESTAMPTZ,
  total_break_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'present',
  note TEXT,
  is_late BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, attendance_date)
);

-- Channels
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.channel_kind NOT NULL DEFAULT 'broadcast',
  created_by UUID NOT NULL,
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Direct Threads
CREATE TABLE IF NOT EXISTS public.direct_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dm_pair_order CHECK (user_a < user_b),
  UNIQUE (org_id, user_a, user_b)
);

-- Message Reads
CREATE TABLE IF NOT EXISTS public.message_reads (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

-- Message Reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- Leave Requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.leave_type NOT NULL DEFAULT 'vacation',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status public.leave_status NOT NULL DEFAULT 'pending',
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Org Invites
CREATE TABLE IF NOT EXISTS public.org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18),'hex'),
  category TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Message Attachments
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','audio','file')),
  filename TEXT NOT NULL,
  duration_ms INT,
  width INT,
  height INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Calls
CREATE TABLE IF NOT EXISTS public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.call_kind NOT NULL DEFAULT 'audio',
  status public.call_status NOT NULL DEFAULT 'ringing',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Call Participants
CREATE TABLE IF NOT EXISTS public.call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state public.participant_state NOT NULL DEFAULT 'invited',
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (call_id, user_id)
);

-- Call Signals
CREATE TABLE IF NOT EXISTS public.call_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  from_uid UUID NOT NULL REFERENCES auth.users(id),
  to_uid UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_signals_call_idx ON public.call_signals(call_id, created_at);

-- Download History
CREATE TABLE IF NOT EXISTS public.download_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  scope TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  data_range_start TIMESTAMPTZ,
  data_range_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ACCESS CONTROL HELPERS
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
$$;

-- 6. RPC FUNCTIONS

CREATE OR REPLACE FUNCTION public.create_org_as_admin(_name text, _org_type text)
RETURNS TABLE(org_id uuid, org_name text, access_code text, org_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  RETURN QUERY SELECT _org.id, _org.name, _org.access_code, _org.org_type;
END; $$;

CREATE OR REPLACE FUNCTION public.join_org_with_code(_code text, _category text)
RETURNS TABLE(org_id uuid, org_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  RETURN QUERY SELECT _org.id, _org.name;
END; $$;

CREATE OR REPLACE FUNCTION public.pulse_checkin(_note text DEFAULT NULL)
RETURNS public.attendance
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END; $$;

CREATE OR REPLACE FUNCTION public.pulse_checkout(_id uuid)
RETURNS public.attendance
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.attendance%ROWTYPE;
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
END; $$;

CREATE OR REPLACE FUNCTION public.pulse_toggle_break(_id uuid)
RETURNS public.attendance
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.attendance%ROWTYPE;
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
END; $$;

CREATE OR REPLACE FUNCTION public.open_dm(_other uuid)
RETURNS public.direct_threads
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _org uuid; _a uuid; _b uuid;
  _thread public.direct_threads%ROWTYPE; _channel public.channels%ROWTYPE; _name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _uid = _other THEN RAISE EXCEPTION 'cannot DM self'; END IF;
  SELECT org_id INTO _org FROM public.profiles WHERE id = _uid;
  IF _org IS NULL THEN RAISE EXCEPTION 'no workspace'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _other AND org_id = _org) THEN RAISE EXCEPTION 'not in workspace'; END IF;
  IF _uid < _other THEN _a := _uid; _b := _other; ELSE _a := _other; _b := _uid; END IF;
  SELECT * INTO _thread FROM public.direct_threads WHERE org_id = _org AND user_a = _a AND user_b = _b;
  IF _thread.id IS NOT NULL THEN RETURN _thread; END IF;
  _name := 'dm:' || _a::text || ':' || _b::text;
  INSERT INTO public.channels(name, kind, org_id, created_by)
  VALUES (_name, 'dm', _org, _uid) RETURNING * INTO _channel;
  INSERT INTO public.direct_threads(org_id, channel_id, user_a, user_b)
  VALUES (_org, _channel.id, _a, _b) RETURNING * INTO _thread;
  RETURN _thread;
END; $$;

CREATE OR REPLACE FUNCTION public.toggle_reaction(_message uuid, _emoji text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END; $$;

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

CREATE OR REPLACE FUNCTION public.accept_invite(_token text)
RETURNS TABLE(org_id uuid, org_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _inv public.org_invites%ROWTYPE; _org public.organizations%ROWTYPE; _email text;
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
  RETURN QUERY SELECT _org.id, _org.name;
END; $$;

CREATE OR REPLACE FUNCTION public.invite_preview(_token text)
RETURNS TABLE(org_name text, email text, expires_at timestamptz, accepted boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT o.name, i.email, i.expires_at, (i.accepted_at IS NOT NULL)
    FROM public.org_invites i JOIN public.organizations o ON o.id = i.org_id
    WHERE i.token = _token;
END; $$;

CREATE OR REPLACE FUNCTION public.lookup_org_by_code(_code text)
RETURNS TABLE(id uuid, name text, org_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, org_type FROM public.organizations WHERE access_code = upper(_code)
$$;

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

CREATE OR REPLACE FUNCTION public.join_call(_call_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _org uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT org_id INTO _org FROM public.profiles WHERE id = _uid;
  IF _org IS NULL THEN RAISE EXCEPTION 'no workspace'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.calls c WHERE c.id = _call_id AND c.org_id = _org) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.call_participants(call_id, user_id, state, joined_at)
  VALUES (_call_id, _uid, 'joined', now())
  ON CONFLICT (call_id, user_id) 
  DO UPDATE SET state = 'joined', joined_at = now(), left_at = NULL;

  UPDATE public.calls SET status = 'active' WHERE id = _call_id AND status = 'ringing';
END; $$;

-- 7. TRIGGERS

CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER tg_leave_updated_at BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'member')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.bump_dm_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.direct_threads SET last_message_at = NEW.created_at WHERE channel_id = NEW.channel_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS bump_dm_thread_trg ON public.messages;
CREATE TRIGGER bump_dm_thread_trg AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_dm_thread();

-- 8. POLICIES (RLS)

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Orgs
CREATE POLICY "orgs_member_select" ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_org_id() OR created_by = auth.uid());
CREATE POLICY "orgs_admin_insert" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "orgs_admin_update" ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (id = public.current_org_id() AND public.is_org_admin());

-- Profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR org_id = public.current_org_id());
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Attendance
CREATE POLICY "attendance_org_select" ON public.attendance FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "attendance_self_insert" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND org_id = public.current_org_id());
CREATE POLICY "attendance_self_update" ON public.attendance FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Channels
CREATE POLICY "channels_org_select" ON public.channels FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "channels_admin_insert" ON public.channels FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND (public.is_org_admin() OR kind = 'dm'));

-- Messages
CREATE POLICY "messages_org_select" ON public.messages FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "messages_org_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND sender_id = auth.uid());

-- DMs
CREATE POLICY "dt_select" ON public.direct_threads FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND (user_a = auth.uid() OR user_b = auth.uid()));

-- Reads
CREATE POLICY "mr_self" ON public.message_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Reactions
CREATE POLICY "mre_select" ON public.message_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.org_id = public.current_org_id()));
CREATE POLICY "mre_insert" ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.org_id = public.current_org_id()));
CREATE POLICY "mre_delete" ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Leave
CREATE POLICY "leave_select" ON public.leave_requests FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND (user_id = auth.uid() OR public.is_org_admin()));
CREATE POLICY "leave_insert_self" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND org_id = public.current_org_id());
CREATE POLICY "leave_update_admin" ON public.leave_requests FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());

-- Invites
CREATE POLICY "invites_select_admin" ON public.org_invites FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());
CREATE POLICY "invites_admin_all" ON public.org_invites FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());

-- Attachments
CREATE POLICY "att_select" ON public.message_attachments FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "att_insert_own" ON public.message_attachments FOR INSERT TO authenticated
  WITH CHECK (uploader_id = auth.uid() AND org_id = public.current_org_id());

-- Calls
CREATE POLICY "calls_select" ON public.calls FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "calls_insert" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND initiator_id = auth.uid());

-- Participants
CREATE POLICY "participants_select" ON public.call_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calls c WHERE c.id = call_id AND c.org_id = public.current_org_id()));

-- Signals
CREATE POLICY "signals_select" ON public.call_signals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.call_participants cp WHERE cp.call_id = call_id AND cp.user_id = auth.uid()));
CREATE POLICY "signals_insert" ON public.call_signals FOR INSERT TO authenticated
  WITH CHECK (from_uid = auth.uid() AND EXISTS (SELECT 1 FROM public.call_participants cp WHERE cp.call_id = call_id AND cp.user_id = auth.uid()));

-- History
CREATE POLICY "history_select" ON public.download_history FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "history_insert_self" ON public.download_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND org_id = public.current_org_id());

-- Tasks
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "tasks_delete_admin" ON public.tasks FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_org_admin());

-- 9. REALTIME
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_threads;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 10. GRANTS
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.org_invites TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_preview(text) TO anon, authenticated;
