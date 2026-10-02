create schema if not exists private;

-- Phase 2.3.1: private Realtime authorization for Call Room signaling.
--
-- Broadcast signaling is ephemeral, but authorization is not optional.
-- Only authenticated users who are currently admitted to the Call Room may
-- read or publish messages on its private topic.

create or replace function private.is_admitted_call_topic(_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.call_room_members crm
    where crm.call_id::text = substring(_topic from '^call-(.+)$')
      and crm.user_id = (select auth.uid())
      and crm.admission_state = 'ADMITTED'
      and crm.organization_id = (select public.current_org_id())
  );
$$;

revoke execute on function private.is_admitted_call_topic(text) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admitted_call_topic(text) to authenticated;

drop policy if exists "admitted call members can receive signaling" on realtime.messages;
create policy "admitted call members can receive signaling"
on realtime.messages
for select
to authenticated
using (
  private.is_admitted_call_topic(realtime.topic())
);

drop policy if exists "admitted call members can send signaling" on realtime.messages;
create policy "admitted call members can send signaling"
on realtime.messages
for insert
to authenticated
with check (
  private.is_admitted_call_topic(realtime.topic())
);

comment on function private.is_admitted_call_topic(text) is
  'Authorizes private Call Room Realtime topics only for authenticated members whose admission state is ADMITTED.';
