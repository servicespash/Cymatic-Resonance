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

CREATE POLICY "participants read signals" ON public.call_signals FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.call_participants cp WHERE cp.call_id = call_signals.call_id AND cp.user_id = auth.uid()));
CREATE POLICY "participants insert signals" ON public.call_signals FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.call_participants cp WHERE cp.call_id = call_signals.call_id AND cp.user_id = auth.uid()));

-- Chat management
ALTER TABLE public.direct_threads ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.direct_threads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
