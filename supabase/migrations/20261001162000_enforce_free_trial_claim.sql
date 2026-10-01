-- Enforce durable Free-trial claims at the database insertion boundary.
-- Any path that creates a Free tracking entitlement must have a verified
-- email or phone identifier that has not previously claimed the trial.

create or replace function public.enforce_free_tracking_trial_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _user auth.users%rowtype;
  _identifier_hash text;
  _identifier_kind text;
begin
  if _uid is null then
    raise exception 'authenticated identity is required to create a free tracking entitlement';
  end if;

  select * into _user from auth.users where id = _uid;

  if _user.email is not null and _user.email_confirmed_at is not null then
    _identifier_hash := encode(digest(lower(trim(_user.email)), 'sha256'), 'hex');
    _identifier_kind := 'EMAIL';
  elsif _user.phone is not null and _user.phone_confirmed_at is not null then
    _identifier_hash := encode(digest(trim(_user.phone), 'sha256'), 'hex');
    _identifier_kind := 'PHONE';
  else
    raise exception 'verified email or phone is required for the Free tracking trial';
  end if;

  insert into public.free_tracking_trial_claims (
    identifier_hash,
    identifier_kind,
    first_organization_id,
    first_user_id
  )
  values (
    _identifier_hash,
    _identifier_kind,
    new.organization_id,
    _uid
  )
  on conflict (identifier_hash) do nothing;

  if not exists (
    select 1
    from public.free_tracking_trial_claims c
    where c.identifier_hash = _identifier_hash
      and c.first_organization_id = new.organization_id
  ) then
    raise exception 'free tracking trial has already been claimed for this verified account identifier';
  end if;

  return new;
end;
$$;

drop trigger if exists free_tracking_trial_claim_guard on public.free_tracking_entitlements;

create trigger free_tracking_trial_claim_guard
before insert on public.free_tracking_entitlements
for each row
execute function public.enforce_free_tracking_trial_claim();

revoke execute on function public.enforce_free_tracking_trial_claim() from public, anon, authenticated;

comment on function public.enforce_free_tracking_trial_claim() is
'Database insertion guard preventing Free tracking entitlement recreation after deletion/account recreation.';
