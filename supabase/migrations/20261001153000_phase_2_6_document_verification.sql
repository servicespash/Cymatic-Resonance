-- Phase 2.6: verifiable engine-issued export records.

create table if not exists public.document_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  document_type text not null check (document_type in ('ATTENDANCE_LEDGER','REGISTRY_EXPORT','REPORT')),
  document_hash text not null check (document_hash ~ '^[0-9a-f]{64}$'),
  row_count integer not null check (row_count >= 0),
  range_start date,
  range_end date,
  created_at timestamptz not null default now()
);

create index if not exists document_verifications_org_created_idx
  on public.document_verifications (organization_id, created_at desc);

alter table public.document_verifications enable row level security;
revoke all on table public.document_verifications from anon, authenticated;

create or replace function public.register_document_verification(
  _document_type text,
  _document_hash text,
  _row_count integer,
  _range_start date default null,
  _range_end date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _org uuid := public.current_org_id();
  _id uuid;
begin
  if _uid is null or _org is null then
    raise exception 'authentication and organization context are required';
  end if;

  if _document_type not in ('ATTENDANCE_LEDGER','REGISTRY_EXPORT','REPORT') then
    raise exception 'invalid document type';
  end if;

  if _document_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid document hash';
  end if;

  if _row_count < 0 then
    raise exception 'invalid row count';
  end if;

  if not exists (
    select 1 from public.organization_members om
    where om.organization_id = _org
      and om.user_id = _uid
      and om.active
  ) then
    raise exception 'not an active organization member';
  end if;

  insert into public.document_verifications (
    organization_id, created_by, document_type, document_hash,
    row_count, range_start, range_end
  )
  values (
    _org, _uid, _document_type, _document_hash,
    _row_count, _range_start, _range_end
  )
  returning id into _id;

  return _id;
end;
$$;

revoke execute on function public.register_document_verification(text,text,integer,date,date) from public, anon;
grant execute on function public.register_document_verification(text,text,integer,date,date) to authenticated;

create or replace function public.verify_document(_verification_id uuid)
returns table (
  verification_id uuid,
  document_type text,
  organization_id uuid,
  document_hash text,
  row_count integer,
  range_start date,
  range_end date,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    d.id,
    d.document_type,
    d.organization_id,
    d.document_hash,
    d.row_count,
    d.range_start,
    d.range_end,
    d.created_at
  from public.document_verifications d
  where d.id = _verification_id;
$$;

revoke execute on function public.verify_document(uuid) from public;
grant execute on function public.verify_document(uuid) to anon, authenticated;

comment on table public.document_verifications is
'Engine-issued export verification records. The QR code resolves to this record rather than an invented verification domain.';
