-- Phase 2.7: durable Free-trial claim history.
-- A deleted auth account must not mint another Free tracking period when the
-- same verified email or phone is used again.
--
-- Raw contact identifiers are never stored here. We store deterministic
-- SHA-256 fingerprints of normalized verified identifiers.

create extension if not exists pgcrypto;

create table if not exists public.free_tracking_trial_claims (
  identifier_hash text primary key,
  identifier_kind text not null check (identifier_kind in ('EMAIL','PHONE')),
  claimed_at timestamptz not null default now(),
  first_organization_id uuid references public.organizations(id) on delete set null,
  first_user_id uuid,
  revoked_at timestamptz
);

revoke all on public.free_tracking_trial_claims from anon, authenticated;
alter table public.free_tracking_trial_claims enable row level security;

create or replace function public.claim_free_tracking_trial(
  _organization_id uuid
)
returns public.free_tracking_entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _org public.organizations%rowtype;
  _user auth.users%rowtype;
  _email_hash text;
  _phone_hash text;
  _row public.free_tracking_entitlements%rowtype;
  _claimed boolean := false;
begin
  if _uid is null then
    raise exception 'authentication is required';
  end if;

  select * into _org
  from public.organizations
  where id = _organization_id;

  if _org.id is null or _org.plan <> 'FREE' then
    raise exception 'free tracking entitlement applies only to FREE organizations';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = _organization_id
      and om.user_id = _uid
      and om.active
  ) then
    raise exception 'not an active organization member';
  end if;

  select * into _user from auth.users where id = _uid;

  if _user.email is not null and _user.email_confirmed_at is not null then
    _email_hash := encode(
      digest(lower(trim(_user.email)), 'sha256'),
      'hex'
    );

    insert into public.free_tracking_trial_claims (
      identifier_hash, identifier_kind, first_organization_id, first_user_id
    )
    values (_email_hash, 'EMAIL', _organization_id, _uid)
    on conflict (identifier_hash) do nothing;

    if found then
      _claimed := true;
    end if;
  end if;

  if not _claimed
     and _user.phone is not null
     and _user.phone_confirmed_at is not null then
    _phone_hash := encode(
      digest(trim(_user.phone), 'sha256'),
      'hex'
    );

    insert into public.free_tracking_trial_claims (
      identifier_hash, identifier_kind, first_organization_id, first_user_id
    )
    values (_phone_hash, 'PHONE', _organization_id, _uid)
    on conflict (identifier_hash) do nothing;

    if found then
      _claimed := true;
    end if;
  end if;

  if not _claimed then
    raise exception 'free tracking trial has already been claimed for this verified account identifier';
  end if;

  insert into public.free_tracking_entitlements (
    organization_id, starts_at, expires_at
  )
  values (
    _organization_id, now(), now() + interval '30 days'
  )
  on conflict (organization_id) do nothing
  returning * into _row;

  if _row.organization_id is null then
    select * into _row
    from public.free_tracking_entitlements
    where organization_id = _organization_id;
  end if;

  return _row;
end;
$$;

revoke execute on function public.claim_free_tracking_trial(uuid) from public, anon;
grant execute on function public.claim_free_tracking_trial(uuid) to authenticated;

comment on table public.free_tracking_trial_claims is
'Durable Free live-tracking trial history. Verified email/phone fingerprints prevent trial renewal through account deletion and recreation.';
