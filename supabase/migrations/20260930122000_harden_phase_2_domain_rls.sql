-- Phase 2.1 hardening: remove overlapping RLS policies and add FK/RLS indexes.


drop policy if exists organization_members_admin_write on public.organization_members;
drop policy if exists entitlements_admin_write on public.entitlements;
drop policy if exists rooms_admin_write on public.rooms;
drop policy if exists room_members_admin_write on public.room_members;
drop policy if exists attendance_sessions_admin_write on public.attendance_sessions;

create policy organization_members_admin_insert
on public.organization_members for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
);

create policy organization_members_admin_update
on public.organization_members for update to authenticated
using (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
)
with check (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
);

create policy organization_members_admin_delete
on public.organization_members for delete to authenticated
using (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
);

create policy entitlements_admin_insert
on public.entitlements for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
);

create policy entitlements_admin_update
on public.entitlements for update to authenticated
using (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
)
with check (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
);

create policy entitlements_admin_delete
on public.entitlements for delete to authenticated
using (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
);

create policy rooms_admin_insert
on public.rooms for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
);

create policy rooms_admin_update
on public.rooms for update to authenticated
using (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
)
with check (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
);

create policy rooms_admin_delete
on public.rooms for delete to authenticated
using (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
);

create policy room_members_admin_insert
on public.room_members for insert to authenticated
with check (
  room_id in (select private.user_admin_room_ids())
);

create policy room_members_admin_update
on public.room_members for update to authenticated
using (
  room_id in (select private.user_admin_room_ids())
)
with check (
  room_id in (select private.user_admin_room_ids())
);

create policy room_members_admin_delete
on public.room_members for delete to authenticated
using (
  room_id in (select private.user_admin_room_ids())
);

create policy attendance_sessions_admin_insert
on public.attendance_sessions for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
);

create policy attendance_sessions_admin_update
on public.attendance_sessions for update to authenticated
using (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
)
with check (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
);

create policy attendance_sessions_admin_delete
on public.attendance_sessions for delete to authenticated
using (
  organization_id = public.current_org_id()
  and (select public.is_org_admin())
);

drop policy if exists organization_members_select_self_or_org on public.organization_members;
create policy organization_members_select_self_or_org
on public.organization_members for select to authenticated
using (
  (select auth.uid()) = user_id
  or organization_id = (select public.current_org_id())
);

drop policy if exists entitlements_select_org on public.entitlements;
create policy entitlements_select_org
on public.entitlements for select to authenticated
using (
  organization_id = (select public.current_org_id())
  and (user_id is null or (select auth.uid()) = user_id)
);

drop policy if exists rooms_member_select on public.rooms;
create policy rooms_member_select
on public.rooms for select to authenticated
using (
  organization_id = (select public.current_org_id())
  and archived_at is null
  and (
    id in (select private.user_room_ids())
    or id in (select private.user_admin_room_ids())
  )
);

drop policy if exists room_members_select on public.room_members;
create policy room_members_select
on public.room_members for select to authenticated
using (
  (select auth.uid()) = user_id
  or room_id in (select private.user_room_ids())
  or room_id in (select private.user_admin_room_ids())
);

drop policy if exists meetings_member_select on public.meetings;
create policy meetings_member_select
on public.meetings for select to authenticated
using (
  organization_id = (select public.current_org_id())
  and exists (
    select 1
    from public.room_members rm
    where rm.room_id = meetings.room_id
      and rm.user_id = (select auth.uid())
      and rm.active
  )
);

drop policy if exists meetings_member_create on public.meetings;
create policy meetings_member_create
on public.meetings for insert to authenticated
with check (
  organization_id = (select public.current_org_id())
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.room_members rm
    where rm.room_id = meetings.room_id
      and rm.user_id = (select auth.uid())
      and rm.active
  )
);

drop policy if exists meetings_admin_update on public.meetings;
create policy meetings_admin_update
on public.meetings for update to authenticated
using (
  organization_id = (select public.current_org_id())
  and (
    created_by = (select auth.uid())
    or (select public.is_org_admin())
  )
)
with check (
  organization_id = (select public.current_org_id())
  and (
    created_by = (select auth.uid())
    or (select public.is_org_admin())
  )
);

drop policy if exists attendance_sessions_org_read on public.attendance_sessions;
create policy attendance_sessions_org_read
on public.attendance_sessions for select to authenticated
using (
  organization_id = (select public.current_org_id())
  and (
    (select public.is_org_admin())
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = attendance_sessions.organization_id
        and om.user_id = (select auth.uid())
        and om.active
    )
  )
);

drop policy if exists attendance_events_org_read on public.attendance_events;
create policy attendance_events_org_read
on public.attendance_events for select to authenticated
using (
  organization_id = (select public.current_org_id())
  and (
    user_id = (select auth.uid())
    or (select public.is_org_admin())
  )
);

drop policy if exists attendance_events_self_insert on public.attendance_events;
create policy attendance_events_self_insert
on public.attendance_events for insert to authenticated
with check (
  organization_id = (select public.current_org_id())
  and user_id = (select auth.uid())
  and type = 'CHECK_IN_REQUESTED'
  and source = 'DEVICE'
);

drop policy if exists location_evidence_org_read on public.location_evidence;
create policy location_evidence_org_read
on public.location_evidence for select to authenticated
using (
  organization_id = (select public.current_org_id())
  and (
    user_id = (select auth.uid())
    or (select public.is_org_admin())
  )
);

drop policy if exists location_evidence_self_insert on public.location_evidence;
create policy location_evidence_self_insert
on public.location_evidence for insert to authenticated
with check (
  organization_id = (select public.current_org_id())
  and user_id = (select auth.uid())
  and source = 'DEVICE'
);

create index if not exists entitlements_user_idx
  on public.entitlements(user_id)
  where user_id is not null;

create index if not exists rooms_created_by_idx
  on public.rooms(created_by);

create index if not exists room_members_room_user_active_idx
  on public.room_members(room_id, user_id)
  where active;

create index if not exists meetings_organization_idx
  on public.meetings(organization_id);

create index if not exists meetings_created_by_idx
  on public.meetings(created_by);

create index if not exists attendance_sessions_created_by_idx
  on public.attendance_sessions(created_by);

create index if not exists attendance_events_org_user_time_idx
  on public.attendance_events(organization_id, user_id, occurred_at desc);

create index if not exists location_evidence_org_user_time_idx
  on public.location_evidence(organization_id, user_id, captured_at desc);

create index if not exists location_evidence_created_at_idx
  on public.location_evidence(created_at desc);

