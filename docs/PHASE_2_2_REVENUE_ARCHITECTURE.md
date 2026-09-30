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
