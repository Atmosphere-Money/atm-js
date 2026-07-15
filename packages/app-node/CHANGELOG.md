# Changelog

## 0.0.0-beta.4

- Replaces pre-fulfillment `insertDeliveryIdOnce` webhook deduplication with a
  durable `deliveryStore` claim/complete/release lifecycle. Failed or non-2xx
  fulfillment releases the claim for ATM redrive; completed duplicates return
  2xx and concurrent in-flight duplicates return a retryable 503. An opaque
  claim id binds complete/release to the worker that owns the processing lease.
- Removes the ignored app-supplied checkout `customerEmail` field from the SDK
  contract and strips it from envelopes produced for older beta callers. Buyer
  email is collected by ATM checkout and processor-confirmed before delivery.
- Corrects the `payer.claimed` event type to the wire payload: `did`, optional
  `paymentIds`/`subscriptionIds`/`ticketIds`, and required `claimedAt` (rather
  than the stale `payerDid` shape).
- Checkout helpers now require `payerDid`/`buyerDid` to be paired with the
  corresponding per-checkout service-auth assertion; guest checkout omits both.
- Replaces the misleading `verifyAtmAttestation` convenience verdict with
  `inspectAtmAttestationRefs`. The new helper only reports reference-slot
  presence and always states that it performed no cryptographic verification;
  fulfillment must use an authenticated ATM webhook, while protocol trust must
  resolve and CID-check the full broker-proof chain.
- Adds bounded checkout `idempotencyKey` and canonical `checkoutExpiresAt`
  fields to the private `atm.checkout.v1` envelope helper.
- Validates those fields before encoding so app retry identities and reserved
  shop/commission checkout deadlines fail early on the app server.
- Aligns the exported 2026-07 event types with the live wire contract:
  product events carry `product: { uri, cid }`, ticket summaries use `tierId`,
  and required claim/waitlist/segment/recipient-authorization fields are no
  longer typed as optional. The stale flat product and `ticketTierId` output
  aliases were removed because ATM never emits them.

## 0.0.0-beta.3

- **Broker DID change (wire-affecting).** `ATM_BROKER_DID` is now the dedicated
  broker identity `did:plc:7srqsetux75b6flzbbyag2ro` (was the shared
  `did:plc:a54sdlhmv7xklga67xamqfyq`). This changes `ATM_BROKER_SERVICE_AUDIENCE`
  (`<brokerDid>#AttestedNetwork`), used as the outbound service-auth `aud` and as
  the expected issuer when verifying ATM's signed webhooks. Apps pinned to an
  earlier version must upgrade, or their service-auth tokens are rejected
  (`BadAudience`) and ATM's webhooks fail issuer verification.
- Adds app-owned product and subscription-offering create/update helpers for
  apps managing canonical ATM catalog records programmatically.
- Adds ticketed-event create/update helpers for event apps configuring shared
  ATM ticket shells programmatically.
- Renames ticket hold/free-claim input fields from `ticketTierId` to `tierId`
  to match the XRPC lexicons before launch.

## 0.0.0-beta.2

- Publishes from the public `Atmosphere-Money/atm-js` SDK repository.
- Enables npm provenance through trusted publishing.
- Keeps the private ATM monorepo package mirror aligned with the public beta.

## 0.0.0-beta.1

- Adds Hono and Cloudflare Workers webhook route helpers.
- Adds request-level ATM service-auth verification helper.
- Adds ticket hold and free limited-ticket claim body validators.
- Adds dedicated typed event aliases for `payment.completed`,
  `tickets.issued`, and `ticket.checked-in`.
- Verifies npm trusted publishing through the GitHub release workflow.

## 0.0.0-beta.0

- Initial closed-beta App Node SDK package shape for server-side ATM app integrations.
- Adds hosted checkout helpers for strict `network.attested.payment.initiate`.
- Adds ATM signed webhook verification plus Request/Response, Next, and Express-style route helpers.
- Adds optional XRPC receiver verification helpers, including receiver-audience construction.
- Adds app-facing ticket availability, hold, free-claim, release, listing, verify, and check-in helpers.
- Adds typed event envelopes for common payment, subscription, product, and ticket events.
- Adds package release checks, API snapshot checks, and dry-run tarball validation.
