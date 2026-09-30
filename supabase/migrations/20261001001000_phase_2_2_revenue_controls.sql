-- Phase 2.2: zero-cost revenue and service-control foundation.
-- This migration is intentionally NOT applied by this change. Apply only after
-- local SQL verification and the production readiness gate.

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  provider text not null,
  transaction_reference text not null,
  feature_key text not null,
  target_plan text not null check (target_plan in ('SILVER', 'GOLD', 'CUSTOM_INSTITUTION')),
  currency text not null,
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, transaction_reference)
);

create index if not exists payment_intents_org_status_idx
  on public.payment_intents(organization_id, status, created_at desc);

create table if not exists public.revenue_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  provider text not null,
  provider_reference text not null,
  transaction_reference text not null,
  currency text not null,
  gross_amount_minor bigint not null check (gross_amount_minor > 0),
  provider_fee_minor bigint not null default 0 check (provider_fee_minor >= 0),
  infrastructure_reserve_minor bigint not null default 0 check (infrastructure_reserve_minor >= 0),
  net_revenue_minor bigint not null default 0 check (net_revenue_minor >= 0),
  target_plan text not null check (target_plan in ('PAID', 'CUSTOM_INSTITUTION')),
  feature_key text not null,
  status text not null default 'SUCCEEDED'
    check (status in ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'REVERSED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique(provider, provider_reference),
  unique(provider, transaction_reference),
  constraint revenue_ledger_split_balances check (
    provider_fee_minor + infrastructure_reserve_minor + net_revenue_minor
      = gross_amount_minor
  )
);

create index if not exists revenue_ledger_org_created_idx
  on public.revenue_ledger(organization_id, created_at desc);

create table if not exists public.service_controls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature_key text not null,
  status text not null check (
    status in ('ENABLED', 'DISABLED', 'COMING_SOON', 'REVENUE_REQUIRED')
  ),
  source text not null default 'SYSTEM' check (
    source in ('SYSTEM', 'ENTITLEMENT', 'ADMIN', 'BILLING')
  ),
  updated_at timestamptz not null default now(),
  unique(organization_id, feature_key)
);

create index if not exists service_controls_org_status_idx
  on public.service_controls(organization_id, status);

create table if not exists public.system_usage_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  metric_key text not null,
  metric_value numeric not null,
  unit text not null,
  recorded_at timestamptz not null default now()
);

create index if not exists system_usage_metrics_org_time_idx
  on public.system_usage_metrics(organization_id, recorded_at desc);

alter table public.payment_intents enable row level security;
alter table public.revenue_ledger enable row level security;
alter table public.service_controls enable row level security;
alter table public.system_usage_metrics enable row level security;

revoke all on public.payment_intents from anon, authenticated;
revoke all on public.revenue_ledger from anon, authenticated;
grant select on public.revenue_ledger to authenticated;
revoke all on public.system_usage_metrics from anon, authenticated;

grant select on public.service_controls to authenticated;

drop policy if exists service_controls_select on public.service_controls;
create policy service_controls_select
  on public.service_controls
  for select
  to authenticated
  using (organization_id = (select current_org_id()));

drop policy if exists revenue_ledger_admin_select on public.revenue_ledger;
create policy revenue_ledger_admin_select
  on public.revenue_ledger
  for select
  to authenticated
  using (
    organization_id = (select current_org_id())
    and (select is_org_admin())
  );

drop policy if exists usage_metrics_admin_select on public.system_usage_metrics;
create policy usage_metrics_admin_select
  on public.system_usage_metrics
  for select
  to authenticated
  using (
    organization_id = (select current_org_id())
    and (select is_org_admin())
  );

-- Existing tenants start with expensive capabilities explicitly locked.
insert into public.service_controls (
  organization_id, feature_key, status, source
)
select o.id, f.feature_key, 'REVENUE_REQUIRED', 'SYSTEM'
from public.organizations o
cross join (
  values
    ('unlimited_members'),
    ('command_center'),
    ('group_calls'),
    ('attendance_exports'),
    ('attendance_analytics'),
    ('continuous_attendance_tracking'),
    ('advanced_notifications'),
    ('custom_attendance_policies'),
    ('custom_entitlements')
) as f(feature_key)
on conflict (organization_id, feature_key) do nothing;

create or replace function public.settle_verified_payment(
  p_organization_id uuid,
  p_provider text,
  p_provider_reference text,
  p_transaction_reference text,
  p_currency text,
  p_gross_amount_minor bigint,
  p_provider_fee_minor bigint,
  p_infrastructure_reserve_minor bigint,
  p_net_revenue_minor bigint,
  p_target_plan text,
  p_feature_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ledger_id uuid;
  intent public.payment_intents%rowtype;
begin
  if p_gross_amount_minor <= 0
     or p_provider_fee_minor < 0
     or p_infrastructure_reserve_minor < 0
     or p_net_revenue_minor < 0 then
    raise exception 'invalid monetary allocation';
  end if;

  if p_provider_fee_minor
     + p_infrastructure_reserve_minor
     + p_net_revenue_minor <> p_gross_amount_minor then
    raise exception 'revenue allocation does not balance';
  end if;

  select *
    into intent
  from public.payment_intents
  where organization_id = p_organization_id
    and provider = p_provider
    and transaction_reference = p_transaction_reference
  for update;

  if not found then
    raise exception 'unknown payment intent';
  end if;

  if intent.currency <> p_currency
     or intent.amount_minor <> p_gross_amount_minor
     or intent.target_plan <> p_target_plan
     or intent.feature_key <> p_feature_key then
    raise exception 'payment does not match payment intent';
  end if;

  insert into public.revenue_ledger (
    organization_id, provider, provider_reference, transaction_reference,
    currency, gross_amount_minor, provider_fee_minor,
    infrastructure_reserve_minor, net_revenue_minor,
    target_plan, feature_key, status, settled_at
  )
  values (
    p_organization_id, p_provider, p_provider_reference, p_transaction_reference,
    p_currency, p_gross_amount_minor, p_provider_fee_minor,
    p_infrastructure_reserve_minor, p_net_revenue_minor,
    p_target_plan, p_feature_key, 'SUCCEEDED', now()
  )
  on conflict (provider, provider_reference)
  do update set
    status = 'SUCCEEDED',
    settled_at = coalesce(public.revenue_ledger.settled_at, now())
  returning id into ledger_id;

  update public.payment_intents
  set status = 'SUCCEEDED', updated_at = now()
  where id = intent.id;

  insert into public.service_controls (
    organization_id, feature_key, status, source, updated_at
  )
  values (
    p_organization_id, p_feature_key, 'ENABLED', 'BILLING', now()
  )
  on conflict (organization_id, feature_key)
  do update set
    status = 'ENABLED',
    source = 'BILLING',
    updated_at = now();

  update public.organizations
  set plan = p_target_plan, updated_at = now()
  where id = p_organization_id
    and plan = 'FREE';

  return ledger_id;
end;
$$;

revoke execute on function public.settle_verified_payment(
  uuid, text, text, text, text, bigint, bigint, bigint, bigint, text, text
) from public, anon, authenticated;
grant execute on function public.settle_verified_payment(
  uuid, text, text, text, text, bigint, bigint, bigint, bigint, text, text
) to service_role;

comment on table public.payment_intents is
  'Server-created payment intents. No client may insert, update, or delete payment intents.';
comment on table public.revenue_ledger is
  'Authoritative settled subscription revenue ledger with a balanced three-way allocation.';
comment on table public.service_controls is
  'Authoritative per-organization feature activation state. Billing can enable a feature only after verified settlement.';
comment on table public.system_usage_metrics is
  'Operational and cost indicators used to enforce the zero-cost-until-revenue policy.';
