
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
