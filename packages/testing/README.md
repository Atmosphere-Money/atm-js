# @atmosphere-money/testing

Testing fixtures and assertions for Atmosphere Money app integrations.

This package is for app test suites. It creates signed ATM webhook fixtures,
sample payment/subscription/ticket events, generic event fixtures,
replay-store helpers, and idempotency-key helpers so apps can test fulfillment
without calling Stripe or ATM production services.

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
  now: fixture.event.created,
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
  createPaymentCompletedFixture,
} from "@atmosphere-money/testing";
import { createNodeWebhookHandler } from "@atmosphere-money/app-node";

const fixture = createPaymentCompletedFixture();
const request = createAtmWebhookRequest(fixture);

const handler = createNodeWebhookHandler({
  secret: ATM_TEST_WEBHOOK_SECRET,
  expectedType: "payment.completed",
  onEvent: async (event) => {
    const metadata = event.data.payment.metadata as
      | { appOrderId?: string }
      | undefined;
    await markOrderPaid(String(metadata?.appOrderId ?? ""));
  },
});

const response = await handler(request);
```

## Replay helper

```ts
import {
  assertFreshDelivery,
  createMemoryReplayStore,
} from "@atmosphere-money/testing";

const replayStore = createMemoryReplayStore();
await assertFreshDelivery(replayStore, "del_payment_completed_fixture");
```

## Generic event fixture

Use `createAtmEventFixture` for documented events that do not need a dedicated
factory.

```ts
import { createAtmEventFixture } from "@atmosphere-money/testing";

const archived = createAtmEventFixture({
  type: "product.archived",
  data: {
    productUri: "at://did:plc:creator/money.atmosphere.product/product_123",
    appDid: "did:plc:app",
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
  payment: { failureCode: "card_declined" },
});
const refundedPayment = createPaymentRefundedFixture({
  payment: { refundedAmountCents: 500 },
});
const disputedPayment = createPaymentDisputedFixture({
  payment: { disputeStatus: "under_review" },
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
- `createMemoryReplayStore`
- `assertFreshDelivery`
- `createAtmIdempotencyKey`

## License

`@atmosphere-money/testing` is released under the MIT license. The package
license does not license the rest of the ATM monorepo or hosted platform code.

## Package boundary

This package does not mock Stripe, ATM checkout, processor webhooks, or PDS
writes. It only helps apps test their own webhook/XRPC receiver and fulfillment
logic with ATM-shaped events.
