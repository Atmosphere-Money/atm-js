# @atmosphere-money/app-node

Server-side TypeScript helpers for apps integrating with Atmosphere Money.

This package is intentionally server-only. Keep app service-auth, webhook
secrets, checkout envelopes, buyer assertions, scan tokens, and fulfillment
mutations out of browser code.

The package is framework-agnostic. Use it from any trusted Node-compatible
backend that can mint AT Protocol service-auth JWTs, call ATM XRPC methods, and
verify raw webhook bodies. Next.js, Express, Fastify, Hono, and backend-only
services should all share the same payment and event contract.

## Status

`@atmosphere-money/app-node` is the canonical SDK package for ATM app-server
integrations. The current beta is published on npm for invited app developers.
The exported API is intended to be the public package surface.
The SDK package is MIT licensed. That license applies to this package only; the
ATM monorepo, dashboard, processor, and business logic remain private
Atmosphere Money code.

## Install

```sh
npm install @atmosphere-money/app-node@beta
```

## Initialize

```ts
import { createAtmAppClient } from "@atmosphere-money/app-node";

const atm = createAtmAppClient({
  getServiceAuthToken: async ({ lxm, aud }) => {
    return mintMyAppServiceAuthJwt({ lxm, aud });
  },
});
```

`getServiceAuthToken` must return a fresh AT Protocol service-auth JWT scoped to
the exact XRPC method being called.

## Start checkout

```ts
const payout = await atm.getPayoutStatus("did:plc:creator");
if (!payout.payable) {
  throw new Error("Recipient cannot receive payments yet");
}

const checkout = await atm.initiatePayment({
  recipient: "did:plc:creator",
  amount: 1200,
  currency: "usd",
  paymentType: "shop",
  environment: "test",
  returnUrl: "https://app.example/orders/ord_123",
  cancelUrl: "https://app.example/products/product_123",
  metadata: {
    appOrderId: "ord_123",
  },
});

return checkout.url;
```

## Verify HTTP webhooks

```ts
import {
  constructAtmWebhookEvent,
  constructTypedAtmWebhookEvent,
} from "@atmosphere-money/app-node";

const event = constructAtmWebhookEvent({
  rawBody,
  secret: process.env.ATM_WEBHOOK_SECRET!,
  headers: {
    signature: request.headers.get("atm-signature"),
    deliveryId: request.headers.get("atm-delivery-id"),
    event: request.headers.get("atm-event"),
    apiVersion: request.headers.get("atm-api-version"),
    environment: request.headers.get("atm-environment"),
  },
});
```

Verify the exact raw request body before JSON mutation and deduplicate by
delivery id before fulfillment.

For common events, use the typed constructor:

```ts
const paymentEvent = constructTypedAtmWebhookEvent({
  rawBody,
  secret: process.env.ATM_WEBHOOK_SECRET!,
  expectedType: "payment.completed",
  headers: {
    signature: request.headers.get("atm-signature"),
    deliveryId: request.headers.get("atm-delivery-id"),
    apiVersion: request.headers.get("atm-api-version"),
    environment: request.headers.get("atm-environment"),
  },
});

console.log(paymentEvent.data.payment.id);
```

## Webhook route helpers

Use the lower-level constructors when you want full control. For common server
routes, the package also includes small handler helpers.

```ts
import { createNodeWebhookHandler } from "@atmosphere-money/app-node";

export const POST = createNodeWebhookHandler({
  secret: process.env.ATM_WEBHOOK_SECRET!,
  expectedType: "payment.completed",
  insertDeliveryIdOnce: async (deliveryId) => {
    return insertDeliveryIdOnce(deliveryId);
  },
  onEvent: async (event) => {
    const metadata = event.data.payment.metadata as
      | { appOrderId?: string }
      | undefined;
    const appOrderId = String(metadata?.appOrderId ?? "");
    if (!appOrderId) {
      return { status: 422, body: { error: "MissingAppOrderId" } };
    }
    await markOrderPaid(appOrderId, event.data.payment.id);
    return { body: { ok: true } };
  },
});
```

Express-style apps can use `createExpressWebhookHandler` with `express.raw()` or
an explicit `getRawBody` callback. `createNextWebhookRoute` is an alias for the
standard Web `Request` handler shape used by Next route handlers. Hono and
Cloudflare Workers can use `createHonoWebhookHandler` and
`createCloudflareWorkerWebhookHandler` so edge-style apps do not need to paste
webhook crypto into their codebase.

## Verify XRPC receiver events

Apps that expose an AT Protocol-shaped receiver can use the same event envelope
with service-auth verification.

```ts
import {
  ATM_EVENT_RECEIVE_NSID,
  createAtmXrpcReceiverAudience,
  constructTypedAtmXrpcReceiverEvent,
  verifyServiceAuthRequest,
} from "@atmosphere-money/app-node";

const audience = createAtmXrpcReceiverAudience("did:plc:yourapp");

const event = await constructTypedAtmXrpcReceiverEvent({
  rawBody,
  appDid: "did:plc:yourapp",
  expectedType: "payment.completed",
  headers: {
    authorization: request.headers.get("authorization"),
    deliveryId: request.headers.get("atm-delivery-id"),
    event: request.headers.get("atm-event"),
    apiVersion: request.headers.get("atm-api-version"),
    environment: request.headers.get("atm-environment"),
  },
  verifyServiceAuthJwt: async ({ token, expectedIss, expectedAud, expectedLxm }) => {
    if (expectedAud !== audience || expectedLxm !== ATM_EVENT_RECEIVE_NSID) {
      throw new Error("Unexpected ATM receiver audience");
    }
    return verifyServiceAuthJwtWithYourAtprotoStack({
      token,
      expectedIss,
      expectedAud,
      expectedLxm,
    });
  },
});

const metadata = event.data.payment.metadata as
  | { appOrderId?: string }
  | undefined;
await markOrderPaid(String(metadata?.appOrderId ?? ""));
```

If your receiver only needs to verify the service-auth request before routing
to custom code, use `verifyServiceAuthRequest` with your app's AT Protocol JWT
verifier:

```ts
import { verifyServiceAuthRequest } from "@atmosphere-money/app-node";

const claims = await verifyServiceAuthRequest({
  request,
  expectedIss: "did:plc:a54sdlhmv7xklga67xamqfyq",
  expectedAud: "did:plc:yourapp#AtmEventReceiver",
  expectedLxm: "money.atmosphere.event.receive",
  verifyServiceAuthJwt: verifyServiceAuthJwtWithYourAtprotoStack,
});
```

## Tickets helpers

```ts
import {
  createFreeTicketClaimBody,
  createTicketHoldBody,
} from "@atmosphere-money/app-node";

const availability = await atm.getTicketAvailability({
  environment: "test",
  eventUri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
});

const hold = await atm.createTicketHold(createTicketHoldBody({
  environment: "test",
  eventUri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
  buyerDid: "did:plc:buyer",
  buyerAssertionJwt: "short-lived-buyer-assertion",
  items: [{ ticketTierId: "tier_123", quantity: 2 }],
  returnUrl: "https://app.example/tickets/return",
  cancelUrl: "https://app.example/events/demo",
}));

const freeClaim = await atm.claimFreeTicket(createFreeTicketClaimBody({
  environment: "test",
  eventUri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
  ticketTierId: "tier_free",
  buyerDid: "did:plc:buyer",
  buyerAssertionJwt: "short-lived-buyer-assertion",
  idempotencyKey: "claim:event:buyer:tier_free",
}));

const listed = await atm.listBuyerTickets({
  environment: "test",
  buyerDid: "did:plc:buyer",
});

const verified = await atm.verifyTicket({
  environment: "test",
  ticketToken: "opaque_scan_token",
});
```

## API surface

- `createAtmAppClient(options)`
- `createAtmCheckoutProduct(input)`
- `ATM_XRPC_METHODS`
- `createPaymentInitiateBody(input)`
- `constructAtmWebhookEvent(options)`
- `constructTypedAtmWebhookEvent(options)`
- `createNodeWebhookHandler(options)`
- `createNextWebhookRoute(options)`
- `createHonoWebhookHandler(options)`
- `createCloudflareWorkerWebhookHandler(options)`
- `createExpressWebhookHandler(options)`
- `createTicketHoldBody(input)`
- `createFreeTicketClaimBody(input)`
- `constructAtmXrpcReceiverEvent(options)`
- `constructTypedAtmXrpcReceiverEvent(options)`
- `createAtmXrpcReceiverAudience(appDid, serviceRef?)`
- `verifyServiceAuthRequest(options)`
- `signAtmWebhookPayload(options)`
- `verifyAtmWebhookSignature(options)`
- `verifyAtmReceiverServiceAuthClaims(options)`
- `AtmApiError`
- `AtmWebhookSignatureError`
- `AtmXrpcReceiverAuthError`

Client methods:

- `atm.getPayoutStatus(actorDid)`
- `atm.initiatePayment(input)`
- `atm.getPaymentStatus(token)`
- `atm.getProfile(actorDid)`
- `atm.createCapacityGroup(input)`
- `atm.updateCapacityGroup(input)`
- `atm.createTicketTier(input)`
- `atm.updateTicketTier(input)`
- `atm.archiveTicketTier(input)`
- `atm.getTicketAvailability(input)`
- `atm.createTicketHold(input)`
- `atm.releaseTicketHold(input)`
- `atm.claimFreeTicket(input)`
- `atm.listBuyerTickets(input)`
- `atm.listOrganizerTickets(input)`
- `atm.verifyTicket(input)`
- `atm.checkInTicket(input)`

## What this package does not cover

- Browser checkout embeds.
- Supper website widgets.
- Minting app service-auth JWTs from your PDS.
- Writing app-specific fulfillment records.
- Replacing ATM webhooks or XRPC receiver delivery.
- Framework-specific routing decisions.

Those are separate integration surfaces so the App Node package can stay small,
auditable, and safe to use from backend code.

## Local checks

```sh
npm run check
npm run release:check
npm run pack:dry-run
```

Before publishing a new beta, read [`RELEASE.md`](./RELEASE.md). `npm run
publish:check` validates the public package metadata and dry-run tarball shape.

For the broader package policy, see [`../../SDK_PUBLISHING.md`](../../SDK_PUBLISHING.md).

## License

`@atmosphere-money/app-node` is released under the MIT license. The package
license does not license the rest of the ATM monorepo or hosted platform code.
