# Phase 2.1 — Domain and Database Contract

**Document owner:** Isabirye Latif  
**GitHub owner:** @servicespash  
**Repository:** servicespash/Cymatic-Resonance  
**Branch:** audit/resonance-runtime-fixes

## Purpose

This contract is the boundary between the existing production data model and the Phase 2 runtime architecture. It prevents the UI, realtime layer, and media layer from inventing operational truth.

## Existing database foundations

The current production database already provides organizations, profiles, channels/messages, calls/call participants, daily attendance, groups/group members, and persisted notifications. These remain compatibility foundations; they are not interchangeable with the normalized Phase 2 concepts.

## Required normalized concepts

| Concept | Authoritative source | Current status |
|---|---|---|
| Organization | PostgreSQL + Auth | Existing |
| Membership | PostgreSQL | Existing, but represented partly through profiles/groups |
| Entitlements | PostgreSQL/server authorization | Implemented; runtime enforcement pending |
| Room | PostgreSQL | Implemented; runtime adapter pending |
| Room membership | PostgreSQL | Implemented; runtime adapter pending |
| Presence | Supabase Realtime | Contract defined; intentionally ephemeral, no durable presence table |
| Meeting | PostgreSQL + LiveKit | Implemented; runtime lifecycle pending |
| Call | PostgreSQL + LiveKit | Existing base; state model must be hardened |
| Attendance session | PostgreSQL | Implemented; session and participant state now separated |
| Attendance event | PostgreSQL append-only evidence | Implemented; transition enforcement pending |
| Location evidence | PostgreSQL | Implemented; validation pipeline pending |
| Notification delivery | Server-side lifecycle | Existing base; delivery architecture incomplete |

## Non-negotiable boundaries

- Supabase Auth owns identity.
- Membership, roles, rooms, and entitlements are authorization data; client flags are never authorization.
- PostgreSQL is authoritative for durable state; Realtime and client caches are projections.
- Presence is ephemeral and timestamped; it is not durable attendance evidence.
- LiveKit is the production media authority; the application must not silently downgrade to uncontrolled P2P.
- Attendance is an authorized event-driven state machine, not a client boolean.
- Location samples are evidence and must carry timestamp, accuracy, distance, geofence result, and quality.
- Call state, signaling state, media state, and UI state remain separate concerns.

## Compatibility strategy

Do not delete or repurpose existing attendance, calls, channels, or groups tables in Phase 2.1.

1. Introduce normalized Phase 2 tables.
2. Add explicit organization/user foreign keys.
3. Build adapters for legacy consumers.
4. Migrate consumers deliberately.
5. Remove legacy concepts only after usage and data migration are verified.

## Phase 2.1 exit criteria

- Domain states are represented in TypeScript.
- Required normalized database tables exist.
- Operational tables have explicit organization boundaries where applicable.
- Foreign keys and uniqueness constraints encode core invariants.
- RLS reflects organization/room/member authorization.
- Generated Supabase types match the database.
- Runtime code stops inventing states absent from this contract.
- State-transition and authorization tests exist.

## Immediate implementation order

1. Create normalized schema migration.
2. Add RLS and indexes from the authorization model.
3. Regenerate Supabase types.
4. Add repository/domain adapters.
5. Replace ad-hoc runtime state objects with these contracts.
6. Run type-check, lint, tests, and database advisors.

## Supabase Preview gate

Supabase Preview is a disposable development database created from the production migration history. It is not a replacement for production and it does not carry production data. Its purpose in this roadmap is to let us apply and verify a schema/RLS migration against an isolated database before the production database is changed.

The GitHub check may legitimately show **Supabase Preview skipped** when the branch has no associated Supabase development branch. That is not a database-health signal. For application-only commits, the skip is acceptable. For a commit that changes supabase/migrations, RLS, functions, triggers, or realtime configuration, the intended gate is:

1. Create or associate a Supabase development branch.
2. Apply the repository migrations there.
3. Run schema, RLS, type-generation, and targeted authorization checks.
4. Run the application CI against the resulting contract.
5. Only after those checks pass, apply/merge the migration to production.

The current production project is healthy and the latest Phase 2 migrations are present in the migration history. We therefore do not need to create a Preview branch merely to fix the current frontend lint failure. We will use the Preview gate before the next production schema change.
