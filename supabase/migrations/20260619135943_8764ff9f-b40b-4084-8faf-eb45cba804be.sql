
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_threads;

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
