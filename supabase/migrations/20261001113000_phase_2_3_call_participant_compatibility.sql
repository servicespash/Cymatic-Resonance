-- Phase 2.3.2: preserve legacy call participant UI flows behind RLS.
--
-- Admission remains authoritative for media access. Legacy participant rows
-- remain the invitation/state projection consumed by the existing provider.

grant select, delete on public.call_participants to authenticated;

-- Direct participant creation/state mutation remains revoked. Admission and
-- self-leave are handled by SECURITY DEFINER RPCs from Phase 2.3.
revoke insert, update on public.call_participants from authenticated;

drop policy if exists "initiator invites participants" on public.call_participants;
drop policy if exists "participants update own state" on public.call_participants;
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
