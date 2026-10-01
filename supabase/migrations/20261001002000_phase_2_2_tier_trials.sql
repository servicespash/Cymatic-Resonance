-- Phase 2.2 entitlement refinement:
-- four commercial tiers, one-time organization trial, server-time expiry,
-- and quota-aware call authorization.
--
-- This migration is not applied to production by this change.

alter table public.organizations
  add column if not exists has_used_trial boolean not null default false,
  add column if not exists trial_plan text,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_expires_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_trial_plan_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_trial_plan_check
      check (trial_plan is null or trial_plan in ('SILVER', 'GOLD', 'CUSTOM_INSTITUTION'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_trial_dates_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_trial_dates_check
      check (
        (trial_plan is null and trial_started_at is null and trial_expires_at is null)
        or
        (trial_plan is not null and trial_started_at is not null and trial_expires_at is not null)
      );
  end if;
end
$$;

create or replace function public.get_effective_entitlement(
  _organization_id uuid
)
returns table (
  effective_plan text,
  base_plan text,
  trial_active boolean,
  trial_plan text,
  trial_expires_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $
  select
    case
      when o.trial_plan is not null
       and o.trial_expires_at is not null
       and o.trial_expires_at > now()
      then o.trial_plan
      else o.plan
    end as effective_plan,
    o.plan as base_plan,
    (
      o.trial_plan is not null
      and o.trial_expires_at is not null
      and o.trial_expires_at > now()
    ) as trial_active,
    o.trial_plan,
    o.trial_expires_at
  from public.organizations o
  where o.id = _organization_id;
$$;

revoke execute on function public.get_effective_entitlement(uuid) from public, anon;
grant execute on function public.get_effective_entitlement(uuid) to authenticated, service_role;

create or replace function public.start_entitlement_trial(
  _plan text,
  _duration_days integer
)
returns table (
  effective_plan text,
  trial_plan text,
  trial_started_at timestamptz,
  trial_expires_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  org_id uuid;
  starts_at timestamptz;
  expires_at timestamptz;
begin
  org_id := public.current_org_id();

  if org_id is null then
    raise exception 'organization context is required';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = org_id
      and public.is_org_admin()
  ) then
    raise exception 'organization administrator privileges are required';
  end if;

  if _plan not in ('SILVER', 'GOLD') then
    raise exception 'only Silver or Gold can be trialed';
  end if;

  if _duration_days < 1 or _duration_days > 30 then
    raise exception 'trial duration must be between 1 and 30 days';
  end if;

  select now(), now() + make_interval(days => _duration_days)
    into starts_at, expires_at;

  update public.organizations
  set
    has_used_trial = true,
    trial_plan = _plan,
    trial_started_at = starts_at,
    trial_expires_at = expires_at,
    updated_at = now()
  where id = org_id
    and has_used_trial = false
    and plan = 'FREE';

  if not found then
    raise exception 'trial has already been used or organization is not on the Free plan';
  end if;

  return query
  select
    _plan,
    _plan,
    starts_at,
    expires_at;
end;
$$;

revoke execute on function public.start_entitlement_trial(text, integer) from public, anon;
grant execute on function public.start_entitlement_trial(text, integer) to authenticated;

create or replace function public.get_call_participant_limit(
  _organization_id uuid,
  _mode text
)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when (
      select effective_plan from public.get_effective_entitlement(_organization_id)
    ) = 'FREE' then 5
    when (
      select effective_plan from public.get_effective_entitlement(_organization_id)
    ) = 'SILVER' then 15
    when (
      select effective_plan from public.get_effective_entitlement(_organization_id)
    ) = 'GOLD' then 30
    when (
      select effective_plan from public.get_effective_entitlement(_organization_id)
    ) = 'CUSTOM_INSTITUTION' then 100
    else 5
  end;
$$;

revoke execute on function public.get_call_participant_limit(uuid, text) from public, anon;
grant execute on function public.get_call_participant_limit(uuid, text) to authenticated, service_role;

comment on column public.organizations.has_used_trial is
  'Immutable one-time trial redemption marker. Expiration never resets this flag.';
comment on column public.organizations.trial_expires_at is
  'Server-generated trial expiry. Authorization uses PostgreSQL now(), never browser time.';
comment on function public.get_effective_entitlement(uuid) is
  'Authoritative effective tier. Active trial temporarily overrides the base plan; expired trials automatically resolve to the base plan.';
comment on function public.get_call_participant_limit(uuid, text) is
  'Authoritative server call-capacity policy. Free tier is capped at five participants and Silver at fifteen participants for both audio and video.';
