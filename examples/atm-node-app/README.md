# ATM Node App Example

Minimal ATM integration example.

It shows:

- using the local `@atmosphere-money/app-node` package
- hosted checkout initiation
- webhook signature verification
- optional XRPC receiver verification
- payment status polling
- ticket availability, hold, free claim, and check-in calls
- idempotent event handling shape

Keep app service-auth, webhook secrets, checkout envelopes, buyer assertions,
scan tokens, and fulfillment mutations on your server.

## Run locally

```sh
cp .env.example .env
npm run build --prefix ../../packages/app-node
npm install
npm run typecheck
npm run smoke
npm run dev
```

The server listens on `http://localhost:8787`.

Routes:

- `GET /health` returns a starter-kit health check.
- `POST /checkout` creates an ATM checkout.
- `GET /status?token=...` polls ATM payment status.
- `POST /webhooks/atm` verifies a signed ATM webhook.
- `POST /xrpc/money.atmosphere.event.receive` shows the optional XRPC receiver shape.
- `GET /tickets/availability` reads app-scoped ticket availability.
- `POST /tickets/hold` creates a ticket hold.
- `POST /tickets/release-hold` releases a ticket hold.
- `POST /tickets/tier` creates a starter ticket tier.
- `POST /tickets/free-claim` claims a limited free ticket without checkout.
- `GET /tickets/buyer` lists app-scoped buyer tickets.
- `POST /tickets/verify` verifies an opaque ticket token without checking in.
- `POST /tickets/check-in` checks in an opaque ticket token.

The example expects `ATM_APP_SERVICE_AUTH` to be a fresh short-lived token for
the method being called. The local demo uses one env var to keep the sample
small, but real apps should mint service-auth per request with the exact `lxm`
and `aud`.

## CI checks

Use these before copying changes into a real app:

```sh
npm run typecheck
npm run smoke
```

`typecheck` keeps the TypeScript helper code honest. `smoke` exercises the
ATM webhook signature format without needing a live checkout or receiver URL.

## Sandbox walkthrough

1. Register the app in the ATM dashboard test environment.
2. Copy the test webhook signing secret into `ATM_WEBHOOK_SECRET`.
3. Add `http://localhost:8787/webhooks/atm` as the test webhook URL through a tunnel.
4. Send a dashboard test event and confirm this server logs it once.
5. Redrive the same event and confirm your idempotency layer treats it as already handled.
6. Call `POST /checkout` and use the returned ATM checkout URL.
7. On return, call `GET /status?token=...`; fulfill only from the webhook/XRPC event.

Webhook signatures use `Atm-Signature: t=<unix>,v1=<hex>` and
`Atm-Delivery-Id`. The signed payload is
`${timestamp}.${deliveryId}.${rawBody}`.

## Package notes

The example depends on the closed-beta package through:

```json
"@atmosphere-money/app-node": "file:../../packages/app-node"
```

For an app outside this repo, replace that with:

```json
"@atmosphere-money/app-node": "beta"
```
