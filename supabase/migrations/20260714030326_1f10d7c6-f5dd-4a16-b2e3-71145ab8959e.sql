
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
