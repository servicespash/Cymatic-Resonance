# Contributing to Cymatic Resonance

**Project owner:** Isabirye Latif  
**GitHub owner:** @servicespash  
**Repository:** servicespash/Cymatic-Resonance  
**Canonical product:** https://resonance.cymatichub.xyz

## Ownership

Isabirye Latif is the project and document owner. The repository uses CODEOWNERS to require owner review for production-critical paths.

Developer identity is represented by GitHub authorship, commit history, pull requests, reviews, and release notes. Do not rewrite authorship to imply work that was not performed by that contributor.

## Contribution standard

Contributions must:
- preserve the production architecture contract;
- use real backend/device/network state for operational behavior;
- avoid mocks and simulations in production paths;
- maintain TypeScript and database type alignment;
- preserve organization and membership authorization boundaries;
- include failure and recovery states;
- add or update tests for behavior that changes;
- avoid exposing secrets in browser code.

## Pull requests

A production-affecting pull request should explain:
1. what changed;
2. which architecture phase it affects;
3. which authoritative state drives the behavior;
4. how failure states are handled;
5. what tests/runtime verification were performed;
6. whether database migrations or security policy changes are included.

CODEOWNERS review is required for protected production paths.

## Commit discipline

Use focused commits with descriptive messages. Preserve accurate Git authorship. Do not use commit history as a place for marketing claims.

## Architecture changes

Changes to identity, entitlements, attendance integrity, realtime authorization, call lifecycle, media transport, or security boundaries require explicit architectural review.

## Production rule

If a feature cannot establish its authoritative state, it must not report success.
