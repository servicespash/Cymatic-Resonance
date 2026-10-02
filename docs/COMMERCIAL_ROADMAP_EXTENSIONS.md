# Commercial Roadmap Extensions

This document records commercial features that are intentionally deferred until the core production release and initial sales plan are complete.

## Student tier — deferred

The Student tier is a post-sales roadmap item. It must not be introduced into the production entitlement catalog until the institutional sales model, verification policy, pricing, fraud controls, and support implications have been reviewed.

Proposed direction:

- Student pricing may target approximately one-third of the applicable institutional tier.
- Eligibility must be verified through institution-controlled credentials such as an approved school email domain or another institution verification mechanism.
- Verification must not require collecting unnecessary identity documents.
- Student eligibility must have an auditable lifecycle: requested, verified, active, expired/revoked.
- Student entitlement must remain separate from institutional organization ownership.
- Abuse prevention and re-verification rules must be defined before implementation.
- The final student price and included capabilities remain undecided.

### Scheduling

The existing technical Phase 2.7 is **Call Audio and Media Lifecycle** and must remain unchanged.

For roadmap tracking, the deferred Student tier is therefore labelled **Commercial Roadmap 2.7-S** rather than replacing the technical Phase 2.7.

It is intentionally scheduled after the sales-plan/revenue-readiness work, not during the current production communication implementation.

## Tier-aware map roadmap

Map capability will progress with entitlement maturity:

- Free: basic attendance and presence visualization; Call Room capacity 5.
- Silver: expanded operational attendance map views; Call Room capacity 15.
- Gold: advanced geofence configuration and richer institutional map controls; Call Room capacity 30.
- Premium / Custom: institution-defined map policies and boundary configuration; Call Room capacity is institution-configured.

Interactive boundary drawing for Gold/Custom is deferred until the underlying attendance/session authorization is hardened. The eventual UI may support mouse/touch drawing of a boundary, but the resulting geometry must be validated and persisted server-side. Client-side geometry alone never authorizes attendance.

## Tier-aware UI roadmap

Settings, command components, controls, map tools, execution charts, call controls, and administrative views must derive their availability from the effective entitlement contract.

A higher tier may expose more controls and larger capacity, but the client must never treat visual availability as authorization. Every privileged operation remains server-side enforced.
