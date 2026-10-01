-- Phase 2.7: server-enforced Free-tier live tracking window.
--
-- Free organizations receive a finite entitlement:
--   * 60 calendar days from first activation
--   * maximum 6 tracked hours per UTC day
-- Usage is measured from server time, never client timestamps.
-- This is an entitlement boundary, not a UI timer.

create table if not exists public.free_tracking_entitlements (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  daily_limit_seconds integer not null default 21600 check (daily_limit_seconds = 21600),
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create table if not exists public.free_tracking_daily_usage (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  tracked_seconds integer not null default 0 check (tracked_seconds >= 0 and tracked_seconds <= 21600),
  last_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id, usage_date)
);

alter table public.free_tracking_entitlements enable row level security;
alter table public.free_tracking_daily_usage enable row level security;

revoke all on public.free_tracking_entitlements from anon, authenticated;
revoke all on public.free_tracking_daily_usage from anon, authenticated;

create or replace function public.ensure_free_tracking_entitlement(
  _organization_id uuid
)
returns public.free_tracking_entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _org public.organizations%rowtype;
  _row public.free_tracking_entitlements%rowtype;
begin
  if _uid is null then
    raise exception 'authentication is required';
  end if;

  select * into _org
  from public.organizations
  where id = _organization_id;

  if _org.id is null or _org.plan <> 'FREE' then
    raise exception 'free tracking entitlement applies only to FREE organizations';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = _organization_id
      and om.user_id = _uid
      and om.active
  ) then
    raise exception 'not an active organization member';
  end if;

  select * into _row
  from public.free_tracking_entitlements
  where organization_id = _organization_id
  for update;

  if _row.organization_id is null then
    insert into public.free_tracking_entitlements (
      organization_id,
      starts_at,
      expires_at
    )
    values (
      _organization_id,
      now(),
      now() + interval '60 days'
    )
    returning * into _row;
  end if;

  return _row;
end;
$$;

revoke execute on function public.ensure_free_tracking_entitlement(uuid) from public, anon;
grant execute on function public.ensure_free_tracking_entitlement(uuid) to authenticated;

create or replace function public.update_live_location(
  _session_id uuid,
  _captured_at timestamptz,
  _latitude double precision,
  _longitude double precision,
  _accuracy_meters double precision
)
returns public.location_tracking_presence
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _session public.attendance_sessions%rowtype;
  _consent public.location_tracking_consents%rowtype;
  _row public.location_tracking_presence%rowtype;
  _org public.organizations%rowtype;
  _entitlement public.free_tracking_entitlements%rowtype;
  _usage public.free_tracking_daily_usage%rowtype;
  _now timestamptz := now();
  _delta integer := 0;
  _remaining integer := 0;
  _effective_captured_at timestamptz;
begin
  if _uid is null then
    raise exception 'authentication is required';
  end if;

  if _latitude not between -90 and 90
     or _longitude not between -180 and 180
     or _accuracy_meters < 0
     or _accuracy_meters > 10000 then
    raise exception 'invalid location observation';
  end if;

  select * into _session
  from public.attendance_sessions s
  where s.id = _session_id
    and s.organization_id = public.current_org_id();

  if _session.id is null then
    raise exception 'attendance session not found';
  end if;

  if _session.state <> 'OPEN' then
    raise exception 'attendance session is not open';
  end if;

  select * into _org
  from public.organizations
  where id = _session.organization_id;

  if _org.id is null then
    raise exception 'organization not found';
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

  select * into _consent
  from public.location_tracking_consents c
  where c.organization_id = _session.organization_id
    and c.user_id = _uid
    and c.session_id = _session.id
    and c.revoked_at is null;

  if _consent.session_id is null then
    raise exception 'location tracking consent is required';
  end if;

  -- Client timestamps are never used to measure entitlement consumption.
  -- The server accepts only a bounded observation age.
  if _captured_at is null
     or _captured_at > _now + interval '30 seconds'
     or _captured_at < _now - interval '2 minutes' then
    raise exception 'location observation timestamp is outside the accepted window';
  end if;

  _effective_captured_at := least(_captured_at, _now);

  if _org.plan = 'FREE' then
    insert into public.free_tracking_entitlements (
      organization_id, starts_at, expires_at
    )
    values (
      _org.id, _now, _now + interval '60 days'
    )
    on conflict (organization_id) do nothing;

    select * into _entitlement
    from public.free_tracking_entitlements
    where organization_id = _org.id
    for update;

    if _now >= _entitlement.expires_at then
      raise exception 'free live tracking period has expired';
    end if;

    insert into public.free_tracking_daily_usage (
      organization_id, user_id, usage_date, tracked_seconds, last_seen_at
    )
    values (
      _org.id, _uid, (_now at time zone 'UTC')::date, 0, _now
    )
    on conflict (organization_id, user_id, usage_date) do nothing;

    select * into _usage
    from public.free_tracking_daily_usage
    where organization_id = _org.id
      and user_id = _uid
      and usage_date = (_now at time zone 'UTC')::date
    for update;

    if _usage.last_seen_at is not null then
      _delta := greatest(
        0,
        least(
          30,
          extract(epoch from (_now - _usage.last_seen_at))::integer
        )
      );
    end if;

    _remaining := _entitlement.daily_limit_seconds - _usage.tracked_seconds;

    if _remaining <= 0 then
      raise exception 'daily live tracking limit of 6 hours has been reached';
    end if;

    _delta := least(_delta, _remaining);

    update public.free_tracking_daily_usage
    set tracked_seconds = tracked_seconds + _delta,
        last_seen_at = _now,
        updated_at = _now
    where organization_id = _org.id
      and user_id = _uid
      and usage_date = (_now at time zone 'UTC')::date;
  end if;

  insert into public.location_tracking_presence (
    session_id,
    organization_id,
    user_id,
    latitude,
    longitude,
    accuracy_meters,
    captured_at,
    updated_at
  )
  values (
    _session.id,
    _session.organization_id,
    _uid,
    _latitude,
    _longitude,
    _accuracy_meters,
    _effective_captured_at,
    _now
  )
  on conflict (session_id, user_id)
  do update set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    accuracy_meters = excluded.accuracy_meters,
    captured_at = excluded.captured_at,
    updated_at = _now
  returning * into _row;

  return _row;
end;
$$;

revoke execute on function public.update_live_location(uuid,timestamptz,double precision,double precision,double precision) from public, anon;
grant execute on function public.update_live_location(uuid,timestamptz,double precision,double precision,double precision) to authenticated;

comment on table public.free_tracking_entitlements is
'Server-enforced Free live-tracking entitlement: 60 calendar days from first activation, with a 6-hour UTC daily ceiling.';

comment on table public.free_tracking_daily_usage is
'Server-accounted live tracking seconds. Client clocks cannot increase entitlement consumption or extend the window.';
