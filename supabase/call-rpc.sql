-- RPC: Join Call
CREATE OR REPLACE FUNCTION public.join_call(_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Insert participant if not exists (state 'joined')
  INSERT INTO public.call_participants (call_id, user_id, state, joined_at)
  VALUES (_call_id, auth.uid(), 'joined', now())
  ON CONFLICT (call_id, user_id) 
  DO UPDATE SET state = 'joined', joined_at = now();

  -- 2. If call was 'ringing', update status to 'active'
  UPDATE public.calls 
  SET status = 'active'
  WHERE id = _call_id AND status = 'ringing';
END;
$$;

-- RPC: Leave Call
CREATE OR REPLACE FUNCTION public.leave_call(_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Mark participant as left
  UPDATE public.call_participants 
  SET state = 'left', left_at = now()
  WHERE call_id = _call_id AND user_id = auth.uid();

  -- 2. If no 'joined' participants left, end the call
  IF NOT EXISTS (
    SELECT 1 FROM public.call_participants 
    WHERE call_id = _call_id AND state = 'joined'
  ) THEN
    UPDATE public.calls SET status = 'ended', ended_at = now() WHERE id = _call_id;
  END IF;
END;
$$;
