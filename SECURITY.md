# Security Policy

**Project owner:** Isabirye Latif  
**Repository:** servicespash/Cymatic-Resonance

## Security scope

Cymatic Resonance handles institutional identity, membership, attendance, location evidence, realtime communication, notifications, and meeting state. Security defects affecting these systems are production-critical.

## Security principles

- Server-side authorization is authoritative.
- Supabase RLS is part of the security boundary.
- Secrets must remain server-side.
- Attendance and GPS evidence must not be manufactured by the client.
- Realtime private channels require authorization.
- Media credentials must be short-lived and scoped.
- Administrative actions must be auditable.
- Suspicious attendance or session activity should be observable.

## Reporting

Security vulnerabilities should be reported privately to the project owner before public disclosure. Do not publish credentials, tokens, personal data, or exploit details in public issues.

## Security changes

Changes to RLS, SECURITY DEFINER functions, grants, authentication, entitlements, attendance validation, realtime authorization, or media token issuance require focused review and verification.
