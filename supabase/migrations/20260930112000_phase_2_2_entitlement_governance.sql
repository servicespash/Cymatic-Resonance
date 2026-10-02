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
      check (plan in ('FREE', 'SILVER', 'GOLD', 'CUSTOM_INSTITUTION'));
  end if;
end
$$;

update public.organizations
set plan = case when plan = 'PAID' then 'SILVER' else 'FREE' end
where plan is null or plan not in ('FREE', 'SILVER', 'GOLD', 'CUSTOM_INSTITUTION');

create table if not exists public.entitlement_upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  requested_plan text not null check (requested_plan in ('SILVER', 'GOLD', 'CUSTOM_INSTITUTION')),
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
    and requested_plan in ('SILVER', 'GOLD', 'CUSTOM_INSTITUTION')
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

create or replace function public.resolve_entitlement_upgrade_request(
  _request_id uuid,
  _approved boolean
)
returns public.organizations
language plpgsql
security invoker
as $$
declare
  request_row public.entitlement_upgrade_requests%rowtype;
  organization_row public.organizations%rowtype;
begin
  if not (select is_org_admin()) then
    raise exception 'organization administrator privileges are required';
  end if;

  select *
  into request_row
  from public.entitlement_upgrade_requests
  where id = _request_id
    and organization_id = (select current_org_id())
  for update;

  if not found then
    raise exception 'upgrade request not found';
  end if;

  if request_row.status <> 'PENDING' then
    raise exception 'upgrade request is no longer pending';
  end if;

  if _approved then
    update public.entitlement_upgrade_requests
    set status = 'APPROVED',
        reviewed_at = now(),
        reviewed_by = (select auth.uid())
    where id = request_row.id;

    select *
    into organization_row
    from public.organizations
    where id = request_row.organization_id;
  else
    update public.entitlement_upgrade_requests
    set status = 'DECLINED',
        reviewed_at = now(),
        reviewed_by = (select auth.uid())
    where id = request_row.id;

    select *
    into organization_row
    from public.organizations
    where id = request_row.organization_id;
  end if;

  return organization_row;
end;
$$;

revoke execute on function public.resolve_entitlement_upgrade_request(uuid, boolean) from public;
revoke execute on function public.resolve_entitlement_upgrade_request(uuid, boolean) from anon;
grant execute on function public.resolve_entitlement_upgrade_request(uuid, boolean) to authenticated;

comment on function public.resolve_entitlement_upgrade_request(uuid, boolean) is
  'Reviews an upgrade request only. Approval never grants a paid entitlement; verified settlement or a separately governed provisioning path must activate the plan.';
