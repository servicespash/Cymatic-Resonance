-- Migration: Create admit_call_room_participant and leave_call_room stored procedures
-- Enables server-side authoritative real-time participant admission compatible with production tables.

CREATE OR REPLACE FUNCTION public.admit_call_room_participant(
  _call_id uuid,
  _user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  call_id uuid,
  organization_id uuid,
  user_id uuid,
  admission_state text,
  participant_limit integer,
  participant_count integer,
  effective_plan text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target_user_id uuid := coalesce(_user_id, auth.uid());
  call_row public.calls%ROWTYPE;
  caller_org uuid;
  participant_limit integer := 50;
  current_count integer := 0;
  plan_tier text := 'FREE';
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication is required';
  END IF;

  SELECT *
    INTO call_row
  FROM public.calls
  WHERE id = _call_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call Room does not exist';
  END IF;

  -- Verify caller organization context
  SELECT org_id INTO caller_org FROM public.profiles WHERE id = caller_id;
  IF call_row.org_id IS NOT NULL AND caller_org IS NOT NULL AND call_row.org_id <> caller_org THEN
    RAISE EXCEPTION 'organization context does not match Call Room';
  END IF;

  IF call_row.status NOT IN ('ringing', 'active') THEN
    RAISE EXCEPTION 'Call Room is not accepting participants';
  END IF;

  -- A caller may admit themselves. Only call initiator may admit others.
  IF target_user_id <> caller_id AND caller_id <> call_row.initiator_id THEN
    RAISE EXCEPTION 'only the Call Room host may admit another participant';
  END IF;

  -- Count current active/joined participants in this call
  SELECT count(*)::integer
    INTO current_count
  FROM public.call_participants
  WHERE public.call_participants.call_id = _call_id
    AND public.call_participants.state = 'joined';

  -- Check entitlement plan if entitlements table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'entitlements') THEN
    SELECT plan INTO plan_tier FROM public.entitlements WHERE organization_id = call_row.org_id LIMIT 1;
    IF plan_tier = 'SILVER' THEN
      participant_limit := 15;
    ELSIF plan_tier = 'GOLD' THEN
      participant_limit := 30;
    ELSIF plan_tier = 'CUSTOM_INSTITUTION' THEN
      participant_limit := 100;
    ELSE
      participant_limit := 5;
    END IF;
  END IF;

  -- Enforce participant capacity unless already joined
  IF current_count >= participant_limit AND NOT EXISTS (
    SELECT 1 FROM public.call_participants
    WHERE public.call_participants.call_id = _call_id
      AND public.call_participants.user_id = target_user_id
      AND public.call_participants.state = 'joined'
  ) THEN
    RAISE EXCEPTION 'Call Room capacity reached: % participants', participant_limit;
  END IF;

  -- Register participant into call_participants
  INSERT INTO public.call_participants (call_id, user_id, state, joined_at)
  VALUES (_call_id, target_user_id, 'joined', now())
  ON CONFLICT (call_id, user_id)
  DO UPDATE SET
    state = 'joined',
    joined_at = coalesce(public.call_participants.joined_at, now()),
    left_at = NULL;

  -- Update call to active
  IF call_row.status = 'ringing' THEN
    UPDATE public.calls SET status = 'active' WHERE id = _call_id;
  END IF;

  RETURN QUERY
  SELECT
    _call_id,
    call_row.org_id,
    target_user_id,
    'ADMITTED'::text,
    participant_limit,
    current_count + 1,
    coalesce(plan_tier, 'FREE');
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.admit_call_room_participant(uuid, uuid) TO authenticated, service_role;

-- Accompanying leave function
CREATE OR REPLACE FUNCTION public.leave_call_room(
  _call_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication is required';
  END IF;

  UPDATE public.call_participants
  SET
    state = 'left',
    left_at = now()
  WHERE call_id = _call_id
    AND user_id = caller_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_call_room(uuid) TO authenticated, service_role;
