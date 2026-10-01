-- Phase 2.3: Call Room membership and authoritative admission.
-- Production is intentionally not modified by this repository change.
--
-- Call Room remains the existing calls/call_participants domain. This migration
-- adds an auditable membership/admission layer without replacing those tables.

create table if not exists public.call_room_members (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'PARTICIPANT'
    check (role in ('HOST', 'PARTICIPANT')),
  admission_state text not null default 'INVITED'
    check (admission_state in ('INVITED', 'ADMITTED', 'DECLINED', 'LEFT', 'REJECTED')),
  invited_at timestamptz not null default now(),
  admitted_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  unique (call_id, user_id),
  unique (call_id, id)
);

alter table public.call_room_members enable row level security;

create index if not exists call_room_members_call_idx
  on public.call_room_members(call_id, admission_state);

create index if not exists call_room_members_user_idx
  on public.call_room_members(user_id, created_at desc);

create index if not exists call_room_members_org_idx
  on public.call_room_members(organization_id, created_at desc);

comment on table public.call_room_members is
  'Authoritative Call Room invitation/admission audit layer. Media transport remains separate.';

-- Existing direct INSERT access would bypass the admission function, so remove it.
revoke insert on public.call_participants from authenticated;

drop policy if exists "initiator invites participants" on public.call_participants;

drop policy if exists "call room members view membership" on public.call_room_members;
create policy "call room members view membership"
on public.call_room_members
for select
to authenticated
using (
  organization_id = public.current_org_id()
  and (
    user_id = auth.uid()
    or exists (
      select 1
      from public.calls c
      where c.id = call_id
        and c.initiator_id = auth.uid()
        and c.org_id = organization_id
    )
  )
);

drop policy if exists "call room members update own state" on public.call_room_members;
create policy "call room members update own state"
on public.call_room_members
for update
to authenticated
using (
  user_id = auth.uid()
  and organization_id = public.current_org_id()
)
with check (
  user_id = auth.uid()
  and organization_id = public.current_org_id()
);

create or replace function public.admit_call_room_participant(
  _call_id uuid,
  _user_id uuid default null
)
returns table (
  call_id uuid,
  organization_id uuid,
  user_id uuid,
  admission_state text,
  participant_limit integer,
  participant_count integer,
  effective_plan text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_user_id uuid := coalesce(_user_id, auth.uid());
  call_row public.calls%rowtype;
  effective_plan_row record;
  participant_limit integer;
  participant_count integer;
  existing_member public.call_room_members%rowtype;
begin
  if caller_id is null then
    raise exception 'authentication is required';
  end if;

  select *
    into call_row
  from public.calls
  where id = _call_id
  for update;

  if not found then
    raise exception 'Call Room does not exist';
  end if;

  if call_row.org_id <> public.current_org_id() then
    raise exception 'organization context does not match Call Room';
  end if;

  if call_row.status not in ('ringing', 'active') then
    raise exception 'Call Room is not accepting participants';
  end if;

  -- A caller may admit themselves. Only the call initiator or an existing
  -- admitted host may admit another institution member.
  if target_user_id <> caller_id
     and caller_id <> call_row.initiator_id then
    raise exception 'only the Call Room host may admit another participant';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = target_user_id
      and p.org_id = call_row.org_id
  ) then
    raise exception 'participant is not an active institution member';
  end if;

  select *
    into effective_plan_row
  from public.get_effective_entitlement(call_row.org_id);

  if effective_plan_row.effective_plan = 'FREE' then
    participant_limit := 5;
  elsif effective_plan_row.effective_plan = 'SILVER' then
    participant_limit := 15;
  elsif effective_plan_row.effective_plan = 'GOLD' then
    participant_limit := 30;
  elsif effective_plan_row.effective_plan = 'CUSTOM_INSTITUTION' then
    participant_limit := 100;
  else
    participant_limit := 5;
  end if;

  select *
    into existing_member
  from public.call_room_members
  where call_id = _call_id
    and user_id = target_user_id
  for update;

  if found and existing_member.admission_state = 'ADMITTED' then
    return query
    select
      _call_id,
      call_row.org_id,
      target_user_id,
      'ADMITTED'::text,
      participant_limit,
      (
        select count(*)::integer
        from public.call_room_members m
        where m.call_id = _call_id
          and m.admission_state = 'ADMITTED'
      ),
      effective_plan_row.effective_plan;
    return;
  end if;

  select count(*)::integer
    into participant_count
  from public.call_room_members m
  where m.call_id = _call_id
    and m.admission_state = 'ADMITTED';

  if participant_count >= participant_limit then
    if found then
      update public.call_room_members
      set admission_state = 'REJECTED'
      where id = existing_member.id;
    else
      insert into public.call_room_members (
        call_id, organization_id, user_id, admission_state
      )
      values (
        _call_id, call_row.org_id, target_user_id, 'REJECTED'
      );
    end if;

    raise exception using
      errcode = 'P0001',
      message = format(
        'Call Room capacity reached for %s: %s participants',
        effective_plan_row.effective_plan,
        participant_limit
      );
  end if;

  if found then
    update public.call_room_members
    set
      admission_state = 'ADMITTED',
      admitted_at = coalesce(admitted_at, now()),
      left_at = null
    where id = existing_member.id;
  else
    insert into public.call_room_members (
      call_id,
      organization_id,
      user_id,
      role,
      admission_state,
      admitted_at
    )
    values (
      _call_id,
      call_row.org_id,
      target_user_id,
      case when target_user_id = call_row.initiator_id then 'HOST' else 'PARTICIPANT' end,
      'ADMITTED',
      now()
    );
  end if;

  insert into public.call_participants (
    call_id,
    user_id,
    state,
    joined_at
  )
  values (
    _call_id,
    target_user_id,
    'joined',
    now()
  )
  on conflict (call_id, user_id)
  do update set
    state = 'joined',
    joined_at = coalesce(public.call_participants.joined_at, now()),
    left_at = null;

  return query
  select
    _call_id,
    call_row.org_id,
    target_user_id,
    'ADMITTED'::text,
    participant_limit,
    participant_count + 1,
    effective_plan_row.effective_plan;
end;
$$;

revoke execute on function public.admit_call_room_participant(uuid, uuid)
  from public, anon;
grant execute on function public.admit_call_room_participant(uuid, uuid)
  to authenticated;

comment on function public.admit_call_room_participant(uuid, uuid) is
  'Authoritative Call Room admission. Enforces organization membership and effective-tier capacity before inserting a joined call participant.';

create or replace function public.leave_call_room(
  _call_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'authentication is required';
  end if;

  update public.call_room_members
  set admission_state = 'LEFT', left_at = now()
  where call_id = _call_id
    and user_id = caller_id
    and organization_id = public.current_org_id()
    and admission_state = 'ADMITTED';

  update public.call_participants
  set state = 'left', left_at = now()
  where call_id = _call_id
    and user_id = caller_id;
end;
$$;

revoke execute on function public.leave_call_room(uuid)
  from public, anon;
grant execute on function public.leave_call_room(uuid)
  to authenticated;

comment on function public.leave_call_room(uuid) is
  'Marks the caller as having left the Call Room without terminating other participants.';

-- Realtime publishes authoritative membership changes for room-aware clients.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'call_room_members'
  ) then
    alter publication supabase_realtime add table public.call_room_members;
  end if;
end
$$;

alter table public.call_room_members replica identity full;
