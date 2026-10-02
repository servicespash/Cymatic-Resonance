-- Phase 2.1 final index coverage for user foreign keys.

create index if not exists attendance_events_user_idx
  on public.attendance_events(user_id);

create index if not exists location_evidence_user_idx
  on public.location_evidence(user_id);
