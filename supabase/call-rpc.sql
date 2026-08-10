-- RPC: Join Call
-- Robustly joins a call room, handles room creation if it doesn't exist
create or replace function join_call(_channel_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  _room_id uuid;
  _user_id uuid := auth.uid();
begin
  -- Get or create active room
  select id into _room_id from call_rooms where channel_id = _channel_id and active = true limit 1;
  
  if _room_id is null then
    insert into call_rooms (channel_id, active) values (_channel_id, true) returning id into _room_id;
  end if;

  -- Upsert participant
  insert into call_participants (room_id, user_id, status)
  values (_room_id, _user_id, 'active')
  on conflict (room_id, user_id)
  do update set status = 'active', last_seen_at = now();

  return jsonb_build_object('room_id', _room_id);
end;
$$;

-- RPC: Leave Call
create or replace function leave_call(_room_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update call_participants 
  set status = 'inactive' 
  where room_id = _room_id and user_id = auth.uid();
end;
$$;

-- RPC: Decline Call
create or replace function decline_call(_call_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update calls
  set status = 'declined'
  where id = _call_id;
  
  update call_participants 
  set state = 'declined' 
  where call_id = _call_id and user_id = auth.uid();
end;
$$;
