-- Phase 2.3.2: preserve legacy call participant UI flows behind RLS.
--
-- Admission remains authoritative for media access. Legacy participant rows
-- remain the invitation/state projection consumed by the existing provider.

grant select, insert, update, delete on public.call_participants to authenticated;

drop policy if exists "initiator invites participants" on public.call_participants;
create policy "initiator invites participants"
on public.call_participants
for insert
to authenticated
with check (
  user_id is not null
  and exists (
    select 1
    from public.calls c
    where c.id = call_participants.call_id
      and c.initiator_id = (select auth.uid())
      and c.org_id = (select public.current_org_id())
      and c.status in ('ringing', 'active')
  )
);

drop policy if exists "participants update own state" on public.call_participants;
create policy "participants update own state"
on public.call_participants
for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.calls c
    where c.id = call_participants.call_id
      and c.org_id = (select public.current_org_id())
  )
)
with check (
  user_id = (select auth.uid())
  and state in ('invited', 'joined', 'declined', 'left')
  and exists (
    select 1
    from public.calls c
    where c.id = call_participants.call_id
      and c.org_id = (select public.current_org_id())
  )
);

drop policy if exists "call initiator or org admin deletes participants" on public.call_participants;
create policy "call initiator or org admin deletes participants"
on public.call_participants
for delete
to authenticated
using (
  exists (
    select 1
    from public.calls c
    where c.id = call_participants.call_id
      and c.org_id = (select public.current_org_id())
      and (
        c.initiator_id = (select auth.uid())
        or (select public.is_org_admin())
      )
  )
);

comment on table public.call_participants is
  'Legacy invitation/state projection. Media admission is governed by admit_call_room_participant().';
