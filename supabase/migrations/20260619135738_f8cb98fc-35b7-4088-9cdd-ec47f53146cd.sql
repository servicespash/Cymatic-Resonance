
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
