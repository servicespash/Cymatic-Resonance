-- Phase 2.4: server-authoritative attendance evidence.
--
-- Devices may submit raw location observations, but they cannot assert
-- distance, geofence membership, verification, or attendance state.

create or replace function private.haversine_meters(
  _lat1 double precision,
  _lng1 double precision,
  _lat2 double precision,
  _lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select 2.0 * 6371000.0 * asin(
    sqrt(
      power(sin(radians(_lat2 - _lat1) / 2.0), 2) +
      cos(radians(_lat1)) *
      cos(radians(_lat2)) *
      power(sin(radians(_lng2 - _lng1) / 2.0), 2)
    )
  );
$$;

revoke execute on function private.haversine_meters(double precision,double precision,double precision,double precision) from public;
grant usage on schema private to authenticated;
grant execute on function private.haversine_meters(double precision,double precision,double precision,double precision) to authenticated;

create or replace function public.record_location_evidence(
  _session_id uuid,
  _captured_at timestamptz,
  _latitude double precision,
  _longitude double precision,
  _accuracy_meters double precision,
  _metadata jsonb default '{}'::jsonb
)
returns public.location_evidence
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _session public.attendance_sessions%rowtype;
  _distance double precision;
  _inside boolean;
  _quality text;
  _row public.location_evidence%rowtype;
begin
  if _uid is null then
    raise exception 'authentication is required';
  end if;

  if _latitude not between -90 and 90
     or _longitude not between -180 and 180 then
    raise exception 'invalid coordinates';
  end if;

  if _accuracy_meters < 0 then
    raise exception 'invalid accuracy';
  end if;

  select *
  into _session
  from public.attendance_sessions s
  where s.id = _session_id
    and s.organization_id = public.current_org_id();

  if _session.id is null then
    raise exception 'attendance session not found';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = _session.organization_id
      and om.user_id = _uid
      and om.active
  ) then
    raise exception 'not an active organization member';
  end if;

  if _session.state <> 'OPEN' then
    raise exception 'attendance session is not open';
  end if;

  _distance := private.haversine_meters(
    _session.latitude,
    _session.longitude,
    _latitude,
    _longitude
  );

  _inside := _distance <= _session.radius_meters;

  _quality := case
    when _accuracy_meters <= _session.accuracy_meters then 'HIGH'
    when _accuracy_meters <= _session.accuracy_meters * 2 then 'MEDIUM'
    else 'LOW'
  end;

  insert into public.location_evidence (
    session_id,
    organization_id,
    user_id,
    captured_at,
    latitude,
    longitude,
    accuracy_meters,
    distance_meters,
    quality,
    is_inside_geofence,
    source,
    metadata
  )
  values (
    _session.id,
    _session.organization_id,
    _uid,
    coalesce(_captured_at, now()),
    _latitude,
    _longitude,
    _accuracy_meters,
    _distance,
    _quality,
    _inside,
    'DEVICE',
    coalesce(_metadata, '{}'::jsonb)
  )
  returning * into _row;

  return _row;
end;
$$;

revoke execute on function public.record_location_evidence(
  uuid,timestamptz,double precision,double precision,double precision,jsonb
) from public, anon;
grant execute on function public.record_location_evidence(
  uuid,timestamptz,double precision,double precision,double precision,jsonb
) to authenticated;

drop policy if exists location_evidence_self_insert on public.location_evidence;

-- Raw evidence is written only through the authoritative RPC above.
revoke insert, update, delete on public.location_evidence from authenticated;

create or replace function public.request_attendance_check_in(
  _session_id uuid
)
returns public.attendance_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _session public.attendance_sessions%rowtype;
  _latest public.location_evidence%rowtype;
  _row public.attendance_events%rowtype;
begin
  if _uid is null then
    raise exception 'authentication is required';
  end if;

  select *
  into _session
  from public.attendance_sessions s
  where s.id = _session_id
    and s.organization_id = public.current_org_id();

  if _session.id is null then
    raise exception 'attendance session not found';
  end if;

  if _session.state <> 'OPEN' then
    raise exception 'attendance session is not open';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = _session.organization_id
      and om.user_id = _uid
      and om.active
  ) then
    raise exception 'not an active organization member';
  end if;

  select *
  into _latest
  from public.location_evidence le
  where le.session_id = _session.id
    and le.user_id = _uid
    and le.source = 'DEVICE'
    and le.is_inside_geofence
    and le.quality in ('HIGH','MEDIUM')
    and le.captured_at >= now() - interval '2 minutes'
  order by le.captured_at desc
  limit 1;

  if _latest.id is null then
    raise exception 'recent valid location evidence is required';
  end if;

  insert into public.attendance_events (
    session_id,
    organization_id,
    user_id,
    type,
    occurred_at,
    source,
    metadata
  )
  values (
    _session.id,
    _session.organization_id,
    _uid,
    'CHECKED_IN',
    now(),
    'SERVER',
    jsonb_build_object(
      'location_evidence_id', _latest.id,
      'accuracy_meters', _latest.accuracy_meters,
      'distance_meters', _latest.distance_meters
    )
  )
  returning * into _row;

  return _row;
end;
$$;

revoke execute on function public.request_attendance_check_in(uuid) from public, anon;
grant execute on function public.request_attendance_check_in(uuid) to authenticated;

drop policy if exists attendance_events_self_insert on public.attendance_events;

-- Clients may request/check-in through server RPCs, but cannot manufacture
-- CHECKED_IN, LOCATION_VERIFIED, or other authoritative event types.
revoke insert, update, delete on public.attendance_events from authenticated;

comment on function public.record_location_evidence(
  uuid,timestamptz,double precision,double precision,double precision,jsonb
) is
'Records raw device coordinates while calculating distance, quality, and geofence membership server-side.';

comment on function public.request_attendance_check_in(uuid) is
'Creates a server-authored CHECKED_IN event only when recent valid server-calculated location evidence places the member inside the session geofence.';
