-- Phase 3 security hardening: pin SECURITY DEFINER/search-path behavior.
-- Public check-in and invite preview remain explicitly public where required.
-- DM thread access is identity-bound and must not be callable anonymously.

alter function public.execute_master_pulse(
  text,
  text,
  double precision,
  double precision,
  boolean,
  text,
  text
) set search_path = pg_catalog, public;

alter function public.get_dm_threads_v2()
  set search_path = pg_catalog, public;

alter function public.sync_workspace_creator_role()
  set search_path = pg_catalog, public;

alter function public.touch_updated_at()
  set search_path = pg_catalog, public;

revoke execute on function public.get_dm_threads_v2() from anon;

comment on function public.execute_master_pulse(text,text,double precision,double precision,boolean,text,text)
is 'Publicly callable self-rush/check-in gateway. Security boundary is session nonce, access code, expiry and geofence validation. Search path is pinned.';

comment on function public.get_dm_threads_v2()
is 'Identity-bound DM thread projection. Anonymous execution is prohibited and search path is pinned.';
