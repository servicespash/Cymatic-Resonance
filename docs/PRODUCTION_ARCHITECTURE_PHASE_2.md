# Cymatic Resonance — Master Production Architecture Plan

**Status:** Architecture locked for implementation planning  
**Architecture phase:** Production Phase 2 — Communication, Code Room & Production Hardening  
**Document owner:** Isabirye Latif  
**GitHub owner:** @servicespash  
**Project owner / brand:** Cymatic Hub / cymatichub.xyz  
**Primary application:** https://resonance.cymatichub.xyz  
**Repository:** servicespash/Cymatic-Resonance  
**Deployment target:** Cloudflare Pages + installable PWA, with native Android/iOS and desktop distributions planned  
**Last revised:** 2026-09-30

> This document is the engineering contract for Cymatic Resonance. Production code must implement this architecture rather than creating UI states that are unsupported by real backend, device, network, or database state.

---

## 1. Ownership and engineering identity

### 1.1 Human ownership

- **Document owner:** Isabirye Latif
- **Project owner:** Isabirye Latif / Cymatic Hub
- **GitHub account:** @servicespash
- **Primary domain:** cymatichub.xyz
- **Resonance application:** resonance.cymatichub.xyz

The owner identity is recorded in repository documentation, CODEOWNERS, contribution guidance, release metadata, and machine-readable site metadata where applicable.

### 1.2 Code ownership

CODEOWNERS is the enforcement mechanism for repository ownership. The canonical owner is:

`@servicespash`

Every production-critical directory must remain reviewable by the code owner. Additional maintainers may be added later without replacing the project owner.

Developer names belong in:
- CODEOWNERS
- contribution documentation
- commit authorship
- pull-request review history
- release notes
- changelog entries where appropriate

They do **not** belong in architecture names. Architecture phases describe system maturity, not individual developers.

---

## 2. Non-negotiable production principles

1. **No fake operational state.**
2. **No simulated attendance or location.**
3. **No synthetic media streams presented as real hardware.**
4. **No fake call connection, fake notification delivery, or demo-only success states.**
5. **No frontend-only authorization.**
6. **No secrets in browser bundles.**
7. **Database state is authoritative for persisted institutional state.**
8. **Realtime state is authoritative for ephemeral collaboration.**
9. **LiveKit/WebRTC is authoritative for media state.**
10. **The UI is a projection of authoritative state.**
11. **Every production feature has explicit success, failure, timeout, retry, and recovery states.**
12. **Every production lifecycle is observable.**
13. **Every privileged operation is authorized server-side.**
14. **Security boundaries are organization-, membership-, role-, room-, and entitlement-aware.**
15. **Architecture changes require evidence: tests, runtime verification, or documented operational constraints.**

---

## 3. System architecture

```text
Cymatic Hub
│
├── Cymatic Study
│
└── Cymatic Resonance
    │
    ├── Identity & Access
    │   ├── Supabase Auth
    │   ├── Profiles
    │   ├── Institutions / Organizations
    │   ├── Memberships
    │   ├── Roles
    │   └── Entitlements
    │
    ├── Operational Engine
    │   ├── Attendance
    │   ├── GPS / Geofencing
    │   ├── Session Tracking
    │   ├── Tasks
    │   ├── Maps
    │   └── Institutional Analytics
    │
    └── Communication Engine
        ├── Code Room
        ├── Presence
        ├── Persistent Chat
        ├── Meetings
        ├── Audio
        ├── Video
        ├── Screen Sharing
        ├── Notifications
        └── LiveKit Media
```

The communication engine and operational engine share identity, membership, entitlements, authorization, observability, and institutional boundaries.

---

## 4. Architecture phases

### Phase 0 — Foundation

**Purpose:** establish repository, authentication, database, deployment, environment, and engineering conventions.

**Exit criteria**
- reproducible builds
- typed application
- authenticated identity
- database migrations
- RLS baseline
- deployment pipeline
- environment separation
- ownership and contribution rules

**Target grade:** A

### Phase 1 — Operational Core

**Purpose:** deliver the institutional execution engine.

Includes:
- attendance
- sessions
- GPS acquisition
- geofencing
- maps
- tasks
- institutional membership
- realtime operational updates
- attendance history
- administrative visibility

**Target grade:** A

### Phase 2 — Production Communication and Code Room

**Purpose:** replace fragile/demo communication behavior with a production communication architecture.

Includes:
- Code Room
- persistent chat
- presence
- meeting lifecycle
- LiveKit media
- call state machine
- ring/ringback lifecycle
- camera/microphone lifecycle
- reconnection
- call history
- notifications
- entitlement-aware room access
- 50-member institutional room model

**Target grade:** A

### Phase 3 — Production Administration and Security Hardening

Includes:
- institutional administration
- role/permission management
- subscription administration
- audit logs
- RLS hardening
- SECURITY DEFINER hardening
- function grants
- secret management
- abuse controls
- rate limits
- security monitoring
- attendance integrity controls

**Target grade:** A+

### Phase 4 — Scale

Includes:
- larger institutions
- workload isolation
- queue-based processing
- optimized indexes
- realtime scaling
- media capacity planning
- storage strategy
- analytics pipelines
- observability and SLOs

**Target grade:** A+

### Phase 5 — Mobile and Desktop Distribution

The web/PWA remains the canonical product surface. Native distributions are delivery targets, not separate application architectures.

Targets:
- Android APK / AAB
- iOS application
- Windows desktop
- macOS desktop
- Linux desktop where justified

Preferred architecture:
- shared TypeScript domain contracts
- shared API/backend
- shared authentication
- shared entitlement model
- shared realtime semantics
- platform-specific shells only where necessary

Candidate delivery technologies may include Capacitor for mobile and Tauri/Electron-class desktop packaging, but the final choice must be made after evaluating security, update mechanisms, media/device APIs, offline requirements, and distribution constraints.

**Important:** an APK or EXE must never become a reason to duplicate the backend or business logic.

**Target grade:** A+

### Phase 6 — Continuous Production

Includes:
- automated releases
- staged deployments
- rollback
- runtime health checks
- synthetic monitoring
- security monitoring
- dependency updates
- disaster recovery
- backup verification
- incident response
- continuous architecture review

**Target grade:** A+

---

## 5. Code Room architecture

“Code Room” is the product name for the institutional realtime room/collaboration surface. It is **not** a programming IDE.

Conceptually, it combines the usability patterns users expect from products such as Google Meet and WhatsApp while implementing an independent architecture.

### Room model

```text
Institution
  └── Workspace
      └── Room
          ├── Members
          ├── Roles
          ├── Entitlements
          ├── Presence
          ├── Meeting
          │   └── LiveKit media
          ├── Persistent Chat
          ├── Reactions
          ├── Tasks
          ├── Attendance
          └── Notifications
```

### Room entry lifecycle

```text
Supabase Auth
  → membership verification
  → entitlement verification
  → room authorization
  → private realtime channel authorization
  → presence registration
  → meeting metadata
  → LiveKit token/session
  → media connection
  → UI projection
```

A user is never considered “in the call” merely because the React UI opened a room.

---

## 6. Entitlement architecture

Onboarding establishes the institutional plan:

```text
Onboarding
  → organization
  → plan
  → entitlement records
  → server authorization
  → frontend capability projection
```

Supported product tiers:

### FREE
Baseline institutional functionality subject to documented limits.

### PAID
Expanded room capacity, communication capability, storage, analytics, and other paid features according to the actual commercial contract.

### CUSTOM / INSTITUTION
Institution-specific limits, administrative controls, larger capacity, custom policies, and contractual features.

The exact limits are configuration data, not hardcoded UI assumptions.

**Security rule:** the frontend may hide unavailable features for usability, but only server/database authorization can grant or deny the capability.

---

## 7. Realtime architecture

### Persistent state
Supabase PostgreSQL.

### Ephemeral collaboration state
Supabase Realtime Presence/Broadcast using authorized private channels.

### Media state
LiveKit/WebRTC.

### UI state
React hooks and domain state derived from authoritative sources.

Example:

```text
DB membership exists
  → Realtime presence = online
  → LiveKit participant joins
  → media state = connected
  → UI = participant visible + connected
```

A media disconnect must not silently erase database membership.

Presence should distinguish states such as:
- ONLINE
- AWAY
- IN_CALL
- MEDIA_CONNECTING
- MEDIA_CONNECTED
- MEDIA_RECONNECTING
- OFFLINE

---

## 8. Production call state machine

Call state and media state must remain separate.

### Call lifecycle

```text
IDLE
  → INVITING
  → RINGING
  → ACCEPTED
  → CONNECTING
  → CONNECTED
  → RECONNECTING ↔ CONNECTED
  → ENDING
  → ENDED
```

Alternative terminal paths:
- DECLINED
- MISSED
- FAILED

### Independent state dimensions

- **CALL STATE:** institutional call lifecycle
- **SIGNAL STATE:** signaling / negotiation lifecycle
- **MEDIA STATE:** actual media connection
- **UI STATE:** presentation derived from the above

Example:

```text
CALL = ACCEPTED
MEDIA = CONNECTING
UI = "Connecting…"
```

It must not become “connected” simply because the user pressed Accept.

---

## 9. Call audio architecture

Use one lifecycle-aware `CallAudioController`.

Responsibilities:
- incoming ringtone
- outgoing ringback
- connecting tone
- connected confirmation
- reconnecting indication
- termination cleanup

Audio must react to authoritative call/media state. Independent recursive timers must not determine whether a call is actually ringing or connected.

---

## 10. Institutional attendance integrity

Attendance is a security-sensitive institutional record.

The baseline architecture is:

```text
Device
  → permission check
  → GPS acquisition
  → accuracy validation
  → session/geofence validation
  → server-side authorization
  → attendance event
  → persistent DB record
  → realtime administrative projection
```

### Anti-abuse requirements

A valid check-in must not be equivalent to “device was once inside a radius.”

The system must be able to distinguish:
- location acquired
- location sufficiently accurate
- user eligible for the session
- user entered the authorized area
- check-in accepted
- check-in locked
- user remained within required area, where policy requires it
- user left the area
- tracking unavailable
- suspicious location signal
- session ended
- check-out/absence transition

### Future institutional tracking model

An administrator may define:
- session center
- geofence radius
- allowed accuracy
- session start/end
- grace period
- required dwell duration
- check-in lock period
- tracking policy
- absence threshold

The center and policy are server-controlled configuration.

### Important security limitation

GPS alone cannot prove physical presence with cryptographic certainty. A production system should therefore use layered evidence and anomaly detection rather than claiming that geolocation is unforgeable.

Future anti-spoofing signals may include:
- impossible travel detection
- accuracy and sensor consistency
- repeated suspicious coordinates
- device integrity signals where available
- platform mock-location indicators where exposed
- timing consistency
- geofence transition evidence
- server-side event ordering
- audit trails

No single signal should be treated as infallible.

---

## 11. Continuous session tracking

For sessions requiring continuous presence:

```text
CHECKED_IN
  → TRACKING
  → LOCATION_VERIFIED
  → WITHIN_GEOFENCE
  ↔ OUTSIDE_GEOFENCE
  → SESSION_ENDED
```

If the device leaves the authorized region, the server must record the transition and apply the institution's configured policy.

Possible policy outcomes:
- warning
- grace period
- temporary status
- marked absent
- administrator notification
- session invalidation

The policy must be explicit and auditable.

---

## 12. GPS/map architecture

The map is a projection of actual coordinates and institutional configuration.

It must never:
- generate random attendance coordinates
- simulate member movement
- report fake GPS
- convert UI animation into operational location
- mark attendance because a map marker visually moved

The server stores authoritative attendance/session events. The frontend visualizes them.

---

## 13. Security architecture

Security is part of the architecture, not a later UI feature.

Required controls:
- Supabase RLS
- organization boundaries
- membership authorization
- role authorization
- room authorization
- entitlement authorization
- secure SECURITY DEFINER functions
- fixed search paths
- explicit function grants
- private realtime channel authorization
- server-side validation
- rate limiting
- abuse detection
- secret isolation
- audit logging

Browser code must never contain:
- Resend secret keys
- privileged Supabase service-role credentials
- LiveKit API secrets
- other server credentials

Secrets belong in server/edge runtime secret stores.

---

## 14. Notifications

Notification delivery must have an observable lifecycle:

```text
EVENT
 → NOTIFICATION CREATED
 → DELIVERY ATTEMPTED
 → DELIVERED / FAILED
 → RETRY / TERMINAL FAILURE
```

Push subscriptions are persistent database records.

The UI must never claim “push enabled” merely because browser subscription code executed.

Email delivery must be server-side through an Edge Function or equivalent backend service.

---

## 15. Database ↔ TypeScript ↔ UI contract

The canonical flow is:

```text
PostgreSQL schema
  → generated Supabase types
  → domain types
  → query/service layer
  → React hooks
  → components
```

Rules:
- avoid `any`
- avoid `as any`
- avoid hardcoded production IDs
- avoid mock domain objects in production paths
- derive UI capability from authoritative state
- regenerate types after schema changes
- test state transitions against real contracts

---

## 16. Production observability

Important event families:

### Calls
- CALL_STARTED
- CALL_INVITE_SENT
- CALL_ACCEPTED
- MEDIA_CONNECTING
- MEDIA_CONNECTED
- MEDIA_RECONNECTING
- CALL_ENDED
- CALL_FAILED

### Attendance
- ATTENDANCE_REQUESTED
- GPS_ACQUIRED
- GPS_VALIDATED
- CHECKIN_RECORDED
- CHECKIN_REJECTED
- GEOFENCE_ENTERED
- GEOFENCE_EXITED
- ATTENDANCE_INVALIDATED

### Security
- AUTHORIZATION_DENIED
- RATE_LIMITED
- SUSPICIOUS_LOCATION
- SUSPICIOUS_SESSION
- PRIVILEGED_ACTION

Logs must contain enough structured context to diagnose failures without unnecessarily storing sensitive personal data.

---

## 17. Search, Google and AI discoverability

The product should be technically discoverable, but no architecture can guarantee ranking or inclusion in third-party AI recommendations.

### Google/indexing readiness

Maintain:
- canonical URLs
- sitemap.xml
- robots.txt
- valid metadata
- descriptive page titles
- Open Graph metadata
- structured data where appropriate
- organization/product/application identity
- documentation pages
- stable public URLs
- no accidental noindex directives
- fast, crawlable public pages
- HTTPS
- Search Console ownership/verification
- consistent domain canonicalization

The public identity should consistently describe:

**Cymatic Hub** → **Cymatic Resonance** → **resonance.cymatichub.xyz**

### AI discoverability

For systems that consume public web content:
- publish authoritative architecture/product documentation
- keep terminology consistent
- identify the project owner
- provide canonical product URLs
- expose clear product capabilities and limitations
- maintain structured documentation
- avoid contradictory descriptions across domains
- keep public technical documentation current

This improves machine-readable clarity; it does not guarantee recommendation by any AI system.

---

## 18. PWA, APK, iOS and desktop strategy

### Canonical architecture

The backend remains shared:

```text
                ┌── Web / PWA
                ├── Android
Supabase/API ───┼── iOS
                ├── Windows
                ├── macOS
                └── Linux (if justified)
```

All clients share:
- authentication
- database contracts
- entitlement model
- room model
- call semantics
- attendance semantics
- authorization
- backend services

Platform-specific code handles:
- notifications
- permissions
- background execution
- native media APIs
- device integrations
- packaging

### PWA

Cloudflare Pages + HTTPS + manifest + service worker remains the first-class web distribution.

### Android

Produce APK/AAB from the shared application architecture. Do not fork the business logic.

### iOS

Produce an App Store-compatible client using the same backend/domain contract.

### Desktop

Produce installable desktop clients for Windows/macOS and, if justified, Linux.

Desktop distribution must preserve secure credential handling and native media/device lifecycle.

---

## 19. Azure and future infrastructure

Azure is a future infrastructure option, not a reason to prematurely duplicate the current backend.

If future requirements justify Azure, evaluate:
- regional requirements
- institutional enterprise contracts
- identity federation
- media infrastructure
- analytics
- disaster recovery
- queues
- object storage
- observability
- compliance requirements

The architecture must remain portable at the domain-contract level.

---

## 20. Implementation sequence

The implementation order is locked as:

1. **2.0 — Architecture Contract**
2. **2.1 — Database + TypeScript Contract**
3. **2.2 — Entitlements and Onboarding**
4. **2.3 — Code Room Membership and Authorization**
5. **2.4 — Presence and Realtime**
6. **2.5 — Call State Machine**
7. **2.6 — LiveKit / WebRTC / TURN**
8. **2.7 — Call Audio and Media Lifecycle**
9. **2.8 — 50-Member Code Room UI**
10. **2.9 — Attendance + Map Integration**
11. **2.10 — Notifications / Push**
12. **2.11 — Security / RLS Hardening**
13. **2.12 — Observability**
14. **2.13 — Cloudflare/PWA Production Validation**
15. **2.14 — CI Verification**
16. **2.15 — Release Candidate**

No later phase should be used to conceal an unresolved earlier architectural defect.

---

## 21. Phase grading standard

| Grade | Meaning |
|---|---|
| A+ | Production-ready, hardened, observable, tested, documented |
| A | Production-capable with no known critical blockers |
| B | Functional but material hardening or reliability work remains |
| C | Partial/demo-capable; important production controls missing |
| D | Placeholder, simulated, or structurally unsafe |
| F | Broken or security-blocking |

Grades are evidence-based and must be attached to a specific phase or subsystem, not used as marketing claims.

---

## 22. Phase 2 completion gate

Phase 2 is complete only when:

### Communication
- incoming/outgoing calls work
- ringing/ringback is state-driven
- accept/decline/missed calls work
- camera/microphone lifecycle is real
- camera switching is real
- media negotiation is deterministic
- reconnection works
- termination is clean
- history is persistent
- notifications correspond to real events

### Code Room
- membership is authorized
- entitlements are enforced
- private realtime channels are authorized
- presence is reliable
- persistent chat exists
- meeting metadata is persistent
- 50-member model is supported
- media uses SFU architecture
- UI follows DB/realtime/media state

### Production integrity
- no fake media
- no simulated call mode
- no fake push success
- no fake attendance
- no production secrets in frontend
- no unresolved critical placeholders
- no frontend-only privilege enforcement
- failure and recovery paths are observable

### Verification
- local tests pass
- type checking passes
- build passes
- CI passes
- production deployment is verified
- critical runtime flows are manually exercised
- security findings are reviewed

---

## 23. Release discipline

```text
feature branch
  → focused implementation
  → automated tests
  → type/build validation
  → runtime verification
  → security review
  → pull request
  → CI
  → code-owner review
  → release candidate
  → production
  → monitoring
```

`main` must remain the production integration branch.

The current architecture branch remains an audit/remediation branch until all Phase 2 gates are satisfied.

---

## 24. Repository documentation contract

The repository should maintain:
- README.md — public project and architecture overview
- docs/PRODUCTION_ARCHITECTURE_PHASE_2.md — master architecture contract
- CONTRIBUTING.md — contribution and ownership rules
- CODEOWNERS — mandatory code ownership
- SECURITY.md — vulnerability reporting and security expectations
- changelog/release notes — material production changes

---

## 25. Final architecture rule

> **Cymatic Resonance must never tell an institution that something happened unless the system can identify the authoritative state that proves it happened.**

For attendance, that proof is an authorized institutional event with validated location evidence.

For calls, that proof is the call lifecycle plus actual media state.

For presence, that proof is realtime presence.

For permissions, that proof is server/database authorization.

For notifications, that proof is a recorded delivery lifecycle.

For the UI, truth is projected—not invented.
