# Phase 2.2 Revenue & Entitlement System

## Zero-cost production boundary

The payment system is intentionally dormant until the production-readiness gate is passed.

Current state:

- Free functionality remains available.
- Paid and custom institutional capabilities are entitlement states, not payment guarantees.
- Revenue-gated heavy services remain \`REVENUE_REQUIRED\` or \`COMING_SOON\`.
- No live payment credentials are required for local development.
- No payment provider is contacted unless a server-side gateway configuration is explicitly present.
- No paid infrastructure is provisioned as a side effect of creating a payment intent.
- Production Supabase migrations are not part of local development or CI verification.

## Financial model

Each settled payment is recorded as integer minor units and must satisfy:

\`gross = provider_fee + infrastructure_reserve + net_revenue\`

The provider fee is authoritative from the payment gateway where available. The infrastructure reserve is an application policy expressed in basis points. Net revenue is the remainder.

Do not hardcode a provider percentage such as 4% or 5%. Gateway pricing is external commercial policy and can change.

## Entitlement activation

The authoritative chain is:

\`payment intent -> verified gateway transaction -> atomic settlement -> revenue ledger -> service control -> entitlement\`

The browser never activates an entitlement.

A duplicate webhook is safe because provider references are unique and settlement is performed in one database transaction.

## Providers

The adapter interface is provider-neutral. The first production candidate is Flutterwave because its Uganda documentation supports card and Uganda mobile-money flows, including MTN and Airtel. MTN Uganda's own Open API remains a viable direct-provider option.

Provider selection is a deployment decision, not an institutional-domain decision.

## Local / sandbox testing

Use only provider test credentials.

Required environment variables for the future Flutterwave adapter:

\`\`\`
SUPABASE_URL=<server-side URL>
SUPABASE_SERVICE_ROLE_KEY=<server-side secret>
FLUTTERWAVE_SECRET_KEY=<test secret only>
FLUTTERWAVE_WEBHOOK_SECRET_HASH=<test webhook secret>
INFRASTRUCTURE_RESERVE_BPS=3000
\`\`\`

Never place these values in \`VITE_*\` variables, browser code, GitHub source, or client-visible configuration.

For local testing, create payment intents against a local/test database and use provider sandbox transactions. Test at minimum:

1. UGX + MTN mobile money.
2. UGX + Airtel mobile money.
3. UGX + card.
4. A supported foreign currency + card.
5. Duplicate webhook delivery.
6. Invalid webhook signature.
7. Wrong transaction reference.
8. Wrong amount.
9. Wrong currency.
10. Replayed successful webhook.

The repository must not contain real card numbers, mobile-money PINs, live payment secrets, or customer payment credentials.

## Cost containment

The system does not attempt to make infrastructure bills disappear. Instead, it prevents optional metered services from activating without verified revenue.

For example:

\`PAID subscription -> verified payment -> service control ENABLED -> heavy service authorization\`

Before that point:

\`PAID feature -> REVENUE_REQUIRED/COMING_SOON -> no heavy-service activation\`

Supabase, Cloudflare, LiveKit, email, SMS, AI APIs, and other providers remain independently subject to their own pricing and account limits. Revenue allocation is an application accounting layer; it is not a promise that an external provider will extend credit.

## Production gate

Do not enable the live gateway until all of the following are verified:

- payment-intent creation is server-only;
- webhook authenticity is verified;
- transaction status is independently verified with the gateway;
- payment amount and currency match the local payment intent;
- settlement is idempotent;
- revenue allocation balances exactly;
- entitlement activation is atomic with settlement;
- refunds/reversals have a defined entitlement policy;
- provider credentials are stored server-side;
- rate limits and webhook replay protection are active;
- billing reconciliation is observable;
- infrastructure reserve policy is documented;
- the Free tier works without any payment dependency.


## Four-tier entitlement contract

The commercial tier model is:

| Tier | Price | Institutional capability |
| --- | --- | --- |
| Free | $0 | Core attendance, presence, messaging, and audio/video calls up to 5 participants |
| Silver | ~$15 | Enhanced presence, live execution channels, small-group execution sync |
| Gold | ~$40 | Full institutional registers, unlimited presence tracking, execution charts, higher-capacity calls |
| Premium / Custom | Custom | Institution-specific infrastructure, meeting quotas, signaling, and SLA controls |

The displayed prices are product configuration, not payment-provider truth. Actual billing amounts will be introduced only when the payment layer is activated.

### Call capacity

Free is not a communication-free tier.

- Direct audio/video communication remains available.
- Group audio/video calls are capped at 5 participants.
- Silver defaults to 15 participants.
- Gold defaults to 25 participants.
- Premium / Custom defaults to 100 participants and can later be institution-configured.

The authoritative limit is checked server-side. UI counters are informational only.

### One-time trial

A Free institution may redeem exactly one Silver or Gold trial.

- Trial duration is server-created and configurable from 1 to 30 days.
- The default product duration is 7 days.
- `has_used_trial` never resets after expiry.
- PostgreSQL `now()` determines expiration.
- Expired trials resolve automatically to the base Free plan.
- Presence sockets are independent of entitlement state and are not forcibly disconnected by trial expiry.
- A successful paid settlement can convert the workspace to the permanent paid tier and clear the temporary trial fields while retaining `has_used_trial = true`.

Trial state is therefore an entitlement overlay, not a replacement for the organization's persistent subscription plan.


## Tier-specific UI and settings contract

Tier selection is not only a price label. The product surface must project the effective entitlement into the relevant controls, settings, quotas, and operational views.

- Free exposes only Free-authorized controls.
- Silver exposes Silver-authorized controls and a 15-participant audio/video capacity.
- Gold exposes Gold-authorized controls, higher call capacity, advanced attendance/map policy controls, and execution analytics.
- Premium / Custom exposes institution-specific controls and quotas returned by server configuration.

A capability that is not authorized must not merely be hidden in one component. The server guard remains authoritative, while the UI explains the reason and presents the upgrade matrix where appropriate.

### Map capability progression

Map functionality is tier-aware but must not fabricate location data.

Free provides basic attendance/presence visualization.

Silver may expose expanded attendance history and operational map views.

Gold may expose advanced geofence policy configuration and richer institutional map controls.

Premium / Custom may expose institution-defined map policies and boundary configuration.

Interactive boundary drawing is a future Gold/Custom capability and belongs after the core attendance/map authorization model is hardened. The client drawing gesture is configuration input only; the server persists and validates the resulting geometry.

### Capacity downgrade behavior

If an institution's effective entitlement decreases while a realtime session is already active, existing participants are not forcibly removed solely because the limit changed.

The server refuses new admissions above the current limit. The active UI displays a collapsible tier matrix explaining the current capacity and available upgrade paths.

Presence sockets and established media sessions remain independent from the upgrade panel lifecycle.
