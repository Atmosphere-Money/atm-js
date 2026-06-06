# Changelog

## 0.0.0-beta.2

- Moves the canonical SDK source to the public `Atmosphere-Money/atm-js` repo.
- Enables npm trusted publishing with provenance from the public SDK repo.

## 0.0.0-beta.1

- Verifies npm trusted publishing through the GitHub release workflow.
- Keeps signed webhook fixtures and replay/idempotency helpers aligned with the
  closed-beta App Node SDK.

## 0.0.0-beta.0

- Initial closed-beta testing package for ATM app integrations.
- Adds signed webhook fixtures and request helpers for route tests.
- Adds dedicated fixtures for payment completion, failure, refund, dispute,
  product archive, subscription update, ticket issuance, and ticket check-in.
- Adds a generic event fixture for all documented ATM event types.
- Adds replay-store helpers and idempotency-key helpers.
- Adds package release checks, API snapshot checks, and dry-run tarball validation.
