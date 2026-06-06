# Changelog

## 0.0.0-beta.2

- Moves the canonical SDK source to the public `Atmosphere-Money/atm-js` repo.
- Enables npm trusted publishing with provenance from the public SDK repo.

## 0.0.0-beta.1

- Adds Hono and Cloudflare Workers webhook route helpers.
- Adds request-level ATM service-auth verification helper.
- Adds ticket hold and free limited-ticket claim body validators.
- Adds dedicated typed event aliases for `payment.completed`,
  `tickets.issued`, and `ticket.checked_in`.
- Verifies npm trusted publishing through the GitHub release workflow.

## 0.0.0-beta.0

- Initial closed-beta App Node SDK package shape for server-side ATM app integrations.
- Adds hosted checkout helpers for strict `network.attested.payment.initiate`.
- Adds ATM signed webhook verification plus Request/Response, Next, and Express-style route helpers.
- Adds optional XRPC receiver verification helpers, including receiver-audience construction.
- Adds app-facing ticket availability, hold, free-claim, release, listing, verify, and check-in helpers.
- Adds typed event envelopes for common payment, subscription, product, and ticket events.
- Adds package release checks, API snapshot checks, and dry-run tarball validation.
