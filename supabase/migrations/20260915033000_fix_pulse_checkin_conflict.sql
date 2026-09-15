-- Fix duplicate key error in pulse_checkin by using ON CONFLICT or checking existence
CREATE OR REPLACE FUNCTION public.pulse_checkin(_note text DEFAULT NULL)
RETURNS public.attendance
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _org_id uuid;
  _cutoff time;
  _row public.attendance%ROWTYPE;
  _late boolean;
  _today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  
  SELECT org_id INTO _org_id FROM public.profiles WHERE id = _uid;
  IF _org_id IS NULL THEN RAISE EXCEPTION 'no workspace'; END IF;

  SELECT day_start_cutoff INTO _cutoff FROM public.organizations WHERE id = _org_id;
  _late := (now() AT TIME ZONE 'UTC')::time > _cutoff;

  -- Use ON CONFLICT to handle already existing check-ins for the day
  -- This prevents the "duplicate key value violates unique constraint" error
  INSERT INTO public.attendance(user_id, org_id, status, note, is_late, attendance_date)
  VALUES (_uid, _org_id, 'present', _note, _late, _today)
  ON CONFLICT (user_id, attendance_date) DO UPDATE 
  SET 
    note = COALESCE(EXCLUDED.note, attendance.note),
    status = EXCLUDED.status,
    is_late = CASE WHEN attendance.is_late THEN true ELSE EXCLUDED.is_late END, -- Keep late if already late
    updated_at = now()
  RETURNING * INTO _row;

  RETURN _row;
END; $$;
