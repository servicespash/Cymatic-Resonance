-- Phase 2.2: Entitlement and onboarding governance
-- Organization plan is authoritative. Upgrade requests never grant access.
-- All new request data is protected by row-level security.

alter table public.organizations
  add column if not exists plan text not null default 'FREE';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_plan_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_plan_check
      check (plan in ('FREE', 'PAID', 'CUSTOM_INSTITUTION'));
  end if;
end
$$;

update public.organizations
set plan = 'FREE'
where plan is null or plan not in ('FREE', 'PAID', 'CUSTOM_INSTITUTION');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'entitlements_plan_check'
      and conrelid = 'public.entitlements'::regclass
  ) then
    alter table public.entitlements
      add constraint entitlements_plan_check
      check (plan in ('FREE', 'PAID', 'CUSTOM_INSTITUTION'));
  end if;
end
$$;

create table if not exists public.entitlement_upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  requested_plan text not null check (requested_plan in ('PAID', 'CUSTOM_INSTITUTION')),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED')),
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

create index if not exists entitlement_upgrade_requests_org_status_idx
  on public.entitlement_upgrade_requests (organization_id, status, created_at desc);

create index if not exists entitlement_upgrade_requests_requester_idx
  on public.entitlement_upgrade_requests (requested_by, created_at desc);

alter table public.entitlement_upgrade_requests enable row level security;

revoke all on table public.entitlement_upgrade_requests from anon;
grant select, insert, update on table public.entitlement_upgrade_requests to authenticated;

drop policy if exists entitlement_upgrade_requests_select on public.entitlement_upgrade_requests;
create policy entitlement_upgrade_requests_select
  on public.entitlement_upgrade_requests
  for select
  to authenticated
  using (
    organization_id = (select current_org_id())
    and (
      requested_by = (select auth.uid())
      or (select is_org_admin())
    )
  );

drop policy if exists entitlement_upgrade_requests_insert on public.entitlement_upgrade_requests;
create policy entitlement_upgrade_requests_insert
  on public.entitlement_upgrade_requests
  for insert
  to authenticated
  with check (
    organization_id = (select current_org_id())
    and requested_by = (select auth.uid())
    and requested_plan in ('PAID', 'CUSTOM_INSTITUTION')
    and status = 'PENDING'
  );

drop policy if exists entitlement_upgrade_requests_update on public.entitlement_upgrade_requests;
create policy entitlement_upgrade_requests_update
  on public.entitlement_upgrade_requests
  for update
  to authenticated
  using (
    organization_id = (select current_org_id())
    and (select is_org_admin())
  )
  with check (
    organization_id = (select current_org_id())
    and (select is_org_admin())
  );

comment on table public.entitlement_upgrade_requests is
  'Governed requests to move an organization from FREE to PAID or CUSTOM_INSTITUTION. Requests never grant access by themselves.';
comment on column public.organizations.plan is
  'Authoritative organization entitlement plan. Client code must never mutate this value directly.';
