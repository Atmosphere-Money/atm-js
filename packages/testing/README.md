# @atmosphere-money/testing

Testing fixtures and assertions for Atmosphere Money app integrations.

This package is for app test suites. It creates signed ATM webhook fixtures,
sample payment/subscription/ticket events, generic event fixtures,
replay-store helpers, and idempotency-key helpers so apps can test fulfillment
without calling Stripe or ATM production services.

Agents should use this package whenever they add an ATM webhook or XRPC
receiver. The expected loop is: create a signed fixture, prove signature
verification, atomically claim the delivery, fulfill from the verified ATM
event, then complete the claim (or release it on failure). Start agent-oriented integrations at
[`https://atmosphere.money/llms.txt`](https://atmosphere.money/llms.txt).

## Status

`@atmosphere-money/testing` is the dev-only testing package for ATM app
integrations. The current beta is published on npm for invited app developers.

## Install

```sh
npm install -D @atmosphere-money/testing@beta
```

Package browser:
[`@atmosphere-money/testing` on npmx](https://npmx.dev/package/@atmosphere-money/testing)

npm remains the canonical install source. Use npmx for README, source,
changelog, provenance, vulnerability, package-size, and registry health review.

## Signed webhook fixture

```ts
import {
  ATM_TEST_WEBHOOK_SECRET,
  createPaymentCompletedFixture,
} from "@atmosphere-money/testing";
import { constructTypedAtmWebhookEvent } from "@atmosphere-money/app-node";

const fixture = createPaymentCompletedFixture({
  payment: {
    id: "pay_test_123",
    metadata: { appOrderId: "ord_123" },
  },
});

const event = constructTypedAtmWebhookEvent({
  rawBody: fixture.rawBody,
  secret: ATM_TEST_WEBHOOK_SECRET,
  expectedType: "payment.completed",
  now: fixture.signatureTimestamp,
  headers: {
    signature: fixture.headers["atm-signature"],
    deliveryId: fixture.headers["atm-delivery-id"],
    event: fixture.headers["atm-event"],
    apiVersion: fixture.headers["atm-api-version"],
    environment: fixture.headers["atm-environment"],
  },
});
```

## Request helper

Use `createAtmWebhookRequest` when your route tests expect a real Web
`Request`.

```ts
import {
  ATM_TEST_WEBHOOK_SECRET,
  createAtmWebhookRequest,
  createMemoryDeliveryStore,
  createPaymentCompletedFixture,
} from "@atmosphere-money/testing";
import { createNodeWebhookHandler } from "@atmosphere-money/app-node";

const fixture = createPaymentCompletedFixture();
const request = createAtmWebhookRequest(fixture);
const deliveryStore = createMemoryDeliveryStore();

const handler = createNodeWebhookHandler({
  secret: ATM_TEST_WEBHOOK_SECRET,
  expectedType: "payment.completed",
  deliveryStore,
  onEvent: async (event) => {
    const metadata = event.data.payment.metadata as
      | { appOrderId?: string }
      | undefined;
    await markOrderPaid(String(metadata?.appOrderId ?? ""));
  },
});

const response = await handler(request);
```

`createMemoryDeliveryStore` is process-local and intended only for tests. In
production, use a durable shared database/KV row with an expiring lease and
condition `complete`/`release` on the exact claim id.

## Delivery lifecycle helper

```ts
import {
  createMemoryDeliveryStore,
} from "@atmosphere-money/testing";

const store = createMemoryDeliveryStore();
const claim = store.claim("del_payment_completed_fixture");
if (claim.status !== "claimed") throw new Error("delivery was not claimable");

try {
  await fulfillPaidOrder({ deliveryId: "del_payment_completed_fixture" });
  store.complete("del_payment_completed_fixture", claim.claimId);
} catch (error) {
  store.release("del_payment_completed_fixture", claim.claimId);
  throw error;
}
```

The older `createMemoryReplayStore` / `assertFreshDelivery` exports remain only
as deprecated compatibility helpers for low-level replay tests. Do not use an
insert-before-fulfillment replay key as a fulfillment gate: a failed attempt
cannot release it for ATM redrive.

## Generic event fixture

Use `createAtmEventFixture` for documented events that do not need a dedicated
factory.

```ts
import { createAtmEventFixture } from "@atmosphere-money/testing";

const archived = createAtmEventFixture({
  type: "product.archived",
  data: {
    product: {
      uri: "at://did:plc:creator/money.atmosphere.product/product_123",
    },
    creatorDid: "did:plc:creator",
  },
});
```

## Common event fixtures

Use dedicated factories for events most apps branch on during fulfillment,
support, and operations.

```ts
import {
  createPaymentDisputedFixture,
  createPaymentFailedFixture,
  createPaymentRefundedFixture,
  createProductArchivedFixture,
  createTicketCheckedInFixture,
} from "@atmosphere-money/testing";

const failedPayment = createPaymentFailedFixture({
  reason: "card_declined",
});
const refundedPayment = createPaymentRefundedFixture({
  amount: 500,
  amountRefundedTotal: 500,
});
const disputedPayment = createPaymentDisputedFixture({
  status: "under_review",
});
const archivedProduct = createProductArchivedFixture();
const checkedInTicket = createTicketCheckedInFixture();
```

## Included fixtures

- `createAtmEventFixture`
- `createPaymentCompletedFixture`
- `createPaymentFailedFixture`
- `createPaymentRefundedFixture`
- `createPaymentDisputedFixture`
- `createProductArchivedFixture`
- `createSubscriptionUpdatedFixture`
- `createTicketCheckedInFixture`
- `createTicketsIssuedFixture`
- `signAtmFixture`
- `createAtmWebhookRequest`
- `createMemoryDeliveryStore`
- `createAtmIdempotencyKey`

## License

`@atmosphere-money/testing` is released under the MIT license. The package
license does not license the rest of the ATM monorepo or hosted platform code.

## Package boundary

This package does not mock Stripe, ATM checkout, processor webhooks, or PDS
writes. It only helps apps test their own webhook/XRPC receiver and fulfillment
logic with ATM-shaped events.
