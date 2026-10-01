-- Phase 2.1: normalized domain foundation.
-- Apply through Supabase migrations only. Do not edit production manually.

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'MEMBER',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  constraint organization_members_role_check check (role in ('OWNER','ADMIN','MODERATOR','MEMBER'))
);

create index if not exists organization_members_user_idx
  on public.organization_members(user_id)
  where active;

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  plan text not null,
  feature text not null,
  enabled boolean not null default true,
  limit_value integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entitlements_plan_check check (plan in ('FREE','SILVER','GOLD','CUSTOM_INSTITUTION')),
  constraint entitlements_limit_check check (limit_value is null or limit_value >= 0)
);

create unique index if not exists entitlements_org_user_feature_idx
  on public.entitlements(organization_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), feature);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  kind text not null default 'GENERAL',
  archived_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_kind_check check (kind in ('GENERAL','CLASS','TEAM','PRIVATE')),
  constraint rooms_name_check check (length(trim(name)) between 1 and 160)
);

create index if not exists rooms_org_active_idx
  on public.rooms(organization_id, created_at desc)
  where archived_at is null;

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'ROOM_MEMBER',
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  constraint room_members_role_check check (role in ('OWNER','ADMIN','MODERATOR','MEMBER','ROOM_MEMBER'))
);

create index if not exists room_members_user_active_idx
  on public.room_members(user_id, room_id)
  where active;

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  state text not null default 'SCHEDULED',
  livekit_room_name text not null unique,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint meetings_state_check check (state in ('SCHEDULED','STARTING','LIVE','ENDING','ENDED','FAILED')),
  constraint meetings_time_check check (ended_at is null or started_at is null or ended_at >= started_at)
);

create index if not exists meetings_room_created_idx
  on public.meetings(room_id, created_at desc);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  state text not null default 'SCHEDULED',
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer not null,
  accuracy_meters integer not null,
  grace_seconds integer not null default 0,
  tracking_required boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_sessions_state_check check (state in ('SCHEDULED','OPEN','ENDED','INVALIDATED')),
  constraint attendance_sessions_lat_check check (latitude between -90 and 90),
  constraint attendance_sessions_lng_check check (longitude between -180 and 180),
  constraint attendance_sessions_radius_check check (radius_meters > 0),
  constraint attendance_sessions_accuracy_check check (accuracy_meters > 0),
  constraint attendance_sessions_grace_check check (grace_seconds >= 0),
  constraint attendance_sessions_time_check check (ends_at > starts_at)
);

create index if not exists attendance_sessions_org_time_idx
  on public.attendance_sessions(organization_id, starts_at desc);

create table if not exists public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  occurred_at timestamptz not null,
  server_recorded_at timestamptz not null default now(),
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint attendance_events_type_check check (type in (
    'SESSION_OPENED','CHECK_IN_REQUESTED','CHECKED_IN','TRACKING_STARTED',
    'LOCATION_VERIFIED','ENTERED_GEOFENCE','EXITED_GEOFENCE','GRACE_STARTED',
    'GRACE_EXPIRED','CHECKED_OUT','SESSION_ENDED','MARKED_ABSENT','INVALIDATED'
  )),
  constraint attendance_events_source_check check (source in ('DEVICE','SERVER','ADMIN','SYSTEM'))
);

create index if not exists attendance_events_session_user_time_idx
  on public.attendance_events(session_id, user_id, occurred_at desc);

create table if not exists public.location_evidence (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_at timestamptz not null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters double precision not null,
  distance_meters double precision not null,
  quality text not null,
  is_inside_geofence boolean not null,
  source text not null default 'DEVICE',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint location_evidence_lat_check check (latitude between -90 and 90),
  constraint location_evidence_lng_check check (longitude between -180 and 180),
  constraint location_evidence_accuracy_check check (accuracy_meters >= 0),
  constraint location_evidence_distance_check check (distance_meters >= 0),
  constraint location_evidence_quality_check check (quality in ('HIGH','MEDIUM','LOW','INVALID','UNAVAILABLE')),
  constraint location_evidence_source_check check (source in ('DEVICE','SERVER','ADMIN','SYSTEM'))
);

create index if not exists location_evidence_session_user_time_idx
  on public.location_evidence(session_id, user_id, captured_at desc);

-- Backfill the normalized membership table from the current one-org-per-profile model.
insert into public.organization_members (organization_id, user_id, role, active)
select p.org_id, p.id,
       case upper(coalesce(p.role, 'member'))
         when 'ADMIN' then 'ADMIN'
         when 'OWNER' then 'OWNER'
         when 'MODERATOR' then 'MODERATOR'
         else 'MEMBER'
       end,
       true
from public.profiles p
where p.org_id is not null
on conflict (organization_id, user_id) do update
set role = excluded.role, active = true, updated_at = now();

alter table public.organization_members enable row level security;
alter table public.entitlements enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.meetings enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_events enable row level security;
alter table public.location_evidence enable row level security;

-- Room authorization is a two-table relationship. Directly referencing
-- room_members from rooms policies and rooms from room_members policies
-- creates recursive RLS evaluation. Keep the membership lookup in a
-- non-exposed SECURITY DEFINER helper with a pinned search_path.
create schema if not exists private;

create or replace function private.user_room_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $phase2$
  select rm.room_id
  from public.room_members rm
  join public.rooms r on r.id = rm.room_id
  where rm.user_id = (select auth.uid())
    and rm.active
    and r.organization_id = public.current_org_id()
    and r.archived_at is null
$phase2$;

create or replace function private.user_admin_room_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $phase2$
  select r.id
  from public.rooms r
  where r.organization_id = public.current_org_id()
    and (select public.is_org_admin())
$phase2$;

revoke execute on function private.user_room_ids() from public;
revoke execute on function private.user_admin_room_ids() from public;
grant usage on schema private to authenticated;
grant execute on function private.user_room_ids() to authenticated;
grant execute on function private.user_admin_room_ids() to authenticated;

create policy organization_members_select_self_or_org
on public.organization_members for select to authenticated
using (user_id = auth.uid() or organization_id = public.current_org_id());

create policy organization_members_admin_write
on public.organization_members for all to authenticated
using (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
)
with check (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
);

create policy entitlements_select_org
on public.entitlements for select to authenticated
using (
  organization_id = public.current_org_id()
  and (user_id is null or user_id = auth.uid())
);

create policy entitlements_admin_write
on public.entitlements for all to authenticated
using (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
)
with check (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
);

create policy rooms_member_select
on public.rooms for select to authenticated
using (
  organization_id = public.current_org_id()
  and archived_at is null
  and (
    id in (select private.user_room_ids())
    or id in (select private.user_admin_room_ids())
  )
);

create policy rooms_admin_write
on public.rooms for all to authenticated
using (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
)
with check (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
);

create policy room_members_select
on public.room_members for select to authenticated
using (
  user_id = auth.uid()
  or room_id in (select private.user_room_ids())
  or room_id in (select private.user_admin_room_ids())
);

create policy room_members_admin_write
on public.room_members for all to authenticated
using (
  room_id in (select private.user_admin_room_ids())
)
with check (
  room_id in (select private.user_admin_room_ids())
);

create policy meetings_member_select
on public.meetings for select to authenticated
using (
  organization_id = public.current_org_id()
  and exists (
    select 1 from public.room_members rm
    where rm.room_id = meetings.room_id and rm.user_id = auth.uid() and rm.active
  )
);

create policy meetings_member_create
on public.meetings for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and created_by = auth.uid()
  and exists (
    select 1 from public.room_members rm
    where rm.room_id = meetings.room_id and rm.user_id = auth.uid() and rm.active
  )
);

create policy meetings_admin_update
on public.meetings for update to authenticated
using (organization_id = public.current_org_id() and (created_by = auth.uid() or public.is_org_admin()))
with check (organization_id = public.current_org_id() and (created_by = auth.uid() or public.is_org_admin()));

create policy attendance_sessions_org_read
on public.attendance_sessions for select to authenticated
using (
  organization_id = public.current_org_id()
  and (
    public.is_org_admin()
    or exists (
      select 1 from public.organization_members om
      where om.organization_id = attendance_sessions.organization_id
        and om.user_id = auth.uid()
        and om.active
    )
  )
);

create policy attendance_sessions_admin_write
on public.attendance_sessions for all to authenticated
using (organization_id = public.current_org_id() and public.is_org_admin())
with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy attendance_events_org_read
on public.attendance_events for select to authenticated
using (
  organization_id = public.current_org_id()
  and (user_id = auth.uid() or public.is_org_admin())
);

create policy attendance_events_self_insert
on public.attendance_events for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and user_id = auth.uid()
  and type = 'CHECK_IN_REQUESTED'
  and source = 'DEVICE'
);

create policy location_evidence_org_read
on public.location_evidence for select to authenticated
using (
  organization_id = public.current_org_id()
  and (user_id = auth.uid() or public.is_org_admin())
);

create policy location_evidence_self_insert
on public.location_evidence for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and user_id = auth.uid()
  and source = 'DEVICE'
);

comment on table public.organization_members is 'Phase 2 normalized organization membership authority.';
comment on table public.entitlements is 'Phase 2 server-enforced feature and plan entitlements.';
comment on table public.rooms is 'Phase 2 institutional Code Room container.';
comment on table public.room_members is 'Phase 2 room-level authorization membership.';
comment on table public.meetings is 'Phase 2 meeting metadata; LiveKit owns media transport.';
comment on table public.attendance_sessions is 'Phase 2 attendance session configuration and lifecycle.';
comment on table public.attendance_events is 'Phase 2 append-only operational attendance evidence.';
comment on table public.location_evidence is 'Phase 2 location evidence; coordinates are evidence, not cryptographic proof.';
