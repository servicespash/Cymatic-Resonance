-- Phase 2.5: consented live location presence.
--
-- Check-in location is durable evidence.
-- Live location is ephemeral operational presence.
-- They must never be treated as the same data product.

alter table public.attendance_events
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists accuracy_meters double precision,
  add column if not exists distance_meters double precision;

create table if not exists public.location_tracking_consents (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (organization_id, user_id, session_id)
);

create index if not exists location_tracking_consents_active_idx
  on public.location_tracking_consents (organization_id, session_id, user_id)
  where revoked_at is null;

alter table public.location_tracking_consents enable row level security;

revoke all on table public.location_tracking_consents from anon;
grant select on table public.location_tracking_consents to authenticated;

drop policy if exists location_tracking_consents_self_read on public.location_tracking_consents;
create policy location_tracking_consents_self_read
on public.location_tracking_consents
for select to authenticated
using (
  user_id = auth.uid()
  and organization_id = public.current_org_id()
);

create table if not exists public.location_tracking_presence (
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision not null check (accuracy_meters >= 0),
  captured_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index if not exists location_tracking_presence_org_session_idx
  on public.location_tracking_presence (organization_id, session_id, updated_at desc);

alter table public.location_tracking_presence enable row level security;

revoke all on table public.location_tracking_presence from anon;
grant select on table public.location_tracking_presence to authenticated;

drop policy if exists location_tracking_presence_self_read on public.location_tracking_presence;
create policy location_tracking_presence_self_read
on public.location_tracking_presence
for select to authenticated
using (
  user_id = auth.uid()
  and organization_id = public.current_org_id()
);

drop policy if exists location_tracking_presence_admin_read on public.location_tracking_presence;
create policy location_tracking_presence_admin_read
on public.location_tracking_presence
for select to authenticated
using (
  organization_id = public.current_org_id()
  and (
    public.is_current_org_admin()
    and exists (
      select 1
      from public.organizations o
      where o.id = location_tracking_presence.organization_id
        and o.plan in ('GOLD', 'CUSTOM_INSTITUTION')
    )
  )
);

create or replace function public.set_location_tracking_consent(
  _session_id uuid,
  _enabled boolean
)
returns public.location_tracking_consents
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _session public.attendance_sessions%rowtype;
  _row public.location_tracking_consents%rowtype;
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

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = _session.organization_id
      and om.user_id = _uid
      and om.active
  ) then
    raise exception 'not an active organization member';
  end if;

  if _enabled then
    insert into public.location_tracking_consents (
      organization_id,
      user_id,
      session_id,
      consented_at,
      revoked_at
    )
    values (
      _session.organization_id,
      _uid,
      _session.id,
      now(),
      null
    )
    on conflict (organization_id, user_id, session_id)
    do update set
      consented_at = now(),
      revoked_at = null
    returning * into _row;
  else
    update public.location_tracking_consents
    set revoked_at = now()
    where organization_id = _session.organization_id
      and user_id = _uid
      and session_id = _session.id
    returning * into _row;

    if _row.session_id is null then
      insert into public.location_tracking_consents (
        organization_id,
        user_id,
        session_id,
        consented_at,
        revoked_at
      )
      values (
        _session.organization_id,
        _uid,
        _session.id,
        now(),
        now()
      )
      returning * into _row;
    end if;
  end if;

  return _row;
end;
$$;

revoke execute on function public.set_location_tracking_consent(uuid,boolean) from public, anon;
grant execute on function public.set_location_tracking_consent(uuid,boolean) to authenticated;

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
begin
  if _uid is null then
    raise exception 'authentication is required';
  end if;

  if _latitude not between -90 and 90
     or _longitude not between -180 and 180
     or _accuracy_meters < 0 then
    raise exception 'invalid location observation';
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
    from public.organizations o
    where o.id = _session.organization_id
      and o.plan in ('SILVER', 'GOLD', 'CUSTOM_INSTITUTION')
  ) then
    raise exception 'live location is not included in the organization plan';
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
  into _consent
  from public.location_tracking_consents c
  where c.organization_id = _session.organization_id
    and c.user_id = _uid
    and c.session_id = _session.id
    and c.revoked_at is null;

  if _consent.session_id is null then
    raise exception 'location tracking consent is required';
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
    coalesce(_captured_at, now()),
    now()
  )
  on conflict (session_id, user_id)
  do update set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    accuracy_meters = excluded.accuracy_meters,
    captured_at = excluded.captured_at,
    updated_at = now()
  returning * into _row;

  return _row;
end;
$$;

revoke execute on function public.update_live_location(uuid,timestamptz,double precision,double precision,double precision) from public, anon;
grant execute on function public.update_live_location(uuid,timestamptz,double precision,double precision,double precision) to authenticated;

create or replace function public.stop_live_location(
  _session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'authentication is required';
  end if;

  delete from public.location_tracking_presence
  where session_id = _session_id
    and user_id = _uid
    and organization_id = public.current_org_id();

  return true;
end;
$$;

revoke execute on function public.stop_live_location(uuid) from public, anon;
grant execute on function public.stop_live_location(uuid) to authenticated;

comment on table public.location_tracking_consents is
'Explicit per-user, per-session consent for live location sharing. Consent is separate from check-in evidence.';

comment on table public.location_tracking_presence is
'Ephemeral current location for consented live tracking. The row is replaced as the user moves; it is not a movement history log.';

comment on column public.attendance_events.latitude is
'Server-authored check-in coordinate. This is the exact recorded position, not a reverse-geocoded label.';

comment on column public.attendance_events.longitude is
'Server-authored check-in coordinate.';

comment on function public.update_live_location(uuid,timestamptz,double precision,double precision,double precision) is
'Updates current live location only after explicit per-session consent and active organization membership.';


-- Realtime projection: the database row remains authoritative; Broadcast is ephemeral.
create or replace function private.broadcast_live_location_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'attendance-live:' || coalesce(NEW.session_id, OLD.session_id)::text,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists location_tracking_presence_broadcast on public.location_tracking_presence;
create trigger location_tracking_presence_broadcast
after insert or update or delete
on public.location_tracking_presence
for each row
execute function private.broadcast_live_location_change();

drop policy if exists live_location_map_receive on realtime.messages;
create policy live_location_map_receive
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1
    from public.attendance_sessions s
    join public.organization_members om
      on om.organization_id = s.organization_id
     and om.user_id = auth.uid()
     and om.active
    join public.organizations o
      on o.id = s.organization_id
    where split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}
      and (
        om.user_id = (
          select p.user_id
          from public.location_tracking_presence p
          where p.session_id = s.id
            and p.user_id = auth.uid()
          limit 1
        )
        or (
          om.role in ('OWNER', 'ADMIN')
          and o.plan in ('GOLD', 'CUSTOM_INSTITUTION')
        )
      )
  )
);

alter table public.location_tracking_presence replica identity full;

comment on function private.broadcast_live_location_change() is
'Projects consented live-location presence to a private Realtime topic. Persistent location state remains in PostgreSQL.';
\n      and s.id = split_part(realtime.topic(), ':', 2)::uuid
      and (
        om.user_id = (
          select p.user_id
          from public.location_tracking_presence p
          where p.session_id = s.id
            and p.user_id = auth.uid()
          limit 1
        )
        or (
          om.role in ('OWNER', 'ADMIN')
          and o.plan in ('GOLD', 'CUSTOM_INSTITUTION')
        )
      )
  )
);

alter table public.location_tracking_presence replica identity full;

comment on function private.broadcast_live_location_change() is
'Projects consented live-location presence to a private Realtime topic. Persistent location state remains in PostgreSQL.';
