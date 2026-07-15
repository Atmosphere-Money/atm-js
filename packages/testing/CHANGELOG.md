# Changelog

## 0.0.0-beta.3

- BREAKING: fixtures now generate the webhook apiVersion `2026-07` contract.
  The envelope carries `createdAt` (ISO 8601 datetime) instead of unix
  `created`; the unix signing time is exposed as `fixture.signatureTimestamp`
  (pass it as `now` to verifiers). Money fields use minor-unit names
  (`amount`, `amountRefundedTotal`, `priorAmount` — never `*Cents`), and
  `subscription.cancelled` is now `subscription.canceled`
  (`#subscriptionCanceled`).
- BREAKING: fixture payloads now mirror the live delivery shapes. Failure,
  refund, and dispute fields moved to the top level of `data` (`reason`,
  `amount`/`amountRefundedTotal`/`partial`, `status`/`disputeReason`);
  `subscription.updated` carries top-level `priorAmount`/`amount`/`currency`/
  `updatedAt`/`updatedBy`; `tickets.issued` carries `hold` + `tickets[]` with
  `id`/`eventId`/`tierId`; `ticket.checked-in` carries `ticket` + `checkIn`;
  `product.archived` carries `product.uri`/`product.cid` + `creatorDid`.
- Adds `ATM_TEST_CREATED_AT` (ISO twin of `ATM_TEST_CREATED`) and
  `createdAt`/`signatureTimestamp` fixture options.
- `AtmTestWebhookEventType` now covers every documented event type in the
  published `money.atmosphere.event.receive` contract (adds `payer.claimed`,
  `ticket.form-submitted`, ticket waitlist + collaboration events,
  `customer.segment.message-requested`, `recipient.authorization.updated`),
  with matching payload `$type` mappings and a coverage test against the
  lexicon.
- Adds a process-local `createMemoryDeliveryStore` for testing the same exact
  claim → fulfill → complete/release lifecycle used by app-node beta.4. The old
  insert-only replay helpers remain deprecated compatibility exports and are
  explicitly unsafe as a fulfillment gate.
- Canonical fixture `$type` values can no longer be overridden by caller data.

## 0.0.0-beta.2

- Publishes from the public `Atmosphere-Money/atm-js` SDK repository.
- Enables npm provenance through trusted publishing.
- Keeps the private ATM monorepo package mirror aligned with the public beta.

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
