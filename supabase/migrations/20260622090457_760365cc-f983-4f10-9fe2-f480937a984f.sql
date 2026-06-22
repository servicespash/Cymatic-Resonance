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

ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER TABLE public.call_participants REPLICA IDENTITY FULL;