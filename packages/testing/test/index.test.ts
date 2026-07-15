import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ATM_TEST_API_VERSION,
  ATM_TEST_CREATED,
  ATM_TEST_CREATED_AT,
  ATM_TEST_EVENT_PAYLOAD_TYPES,
  ATM_TEST_WEBHOOK_SECRET,
  assertFreshDelivery,
  createAtmIdempotencyKey,
  createAtmEventFixture,
  createAtmWebhookRequest,
  createMemoryDeliveryStore,
  createMemoryReplayStore,
  createPaymentCompletedFixture,
  createPaymentDisputedFixture,
  createPaymentFailedFixture,
  createPaymentRefundedFixture,
  createProductArchivedFixture,
  createSubscriptionUpdatedFixture,
  createTicketCheckedInFixture,
  createTicketsIssuedFixture,
  signAtmFixture,
} from "../src/index";
import {
  createNodeWebhookHandler,
  constructTypedAtmWebhookEvent,
  verifyAtmWebhookSignature,
} from "../../app-node/src/index";

const payment = createPaymentCompletedFixture({
  payment: {
    id: "pay_test_fixture",
    amount: 2500,
    metadata: { appOrderId: "ord_test_fixture" },
  },
});

assert.equal(payment.event.type, "payment.completed");
assert.equal(payment.event.data.$type, "money.atmosphere.event.receive#paymentCompleted");
assert.equal(payment.event.data.payment.id, "pay_test_fixture");
assert.equal(payment.event.data.payment.amount, 2500);
// 2026-07 envelope: ISO createdAt; the unix signing time is exposed separately.
assert.equal(payment.event.apiVersion, ATM_TEST_API_VERSION);
assert.equal(payment.event.apiVersion, "2026-07");
assert.equal(payment.event.createdAt, ATM_TEST_CREATED_AT);
assert.equal(payment.signatureTimestamp, ATM_TEST_CREATED);
assert.equal(payment.headers["atm-delivery-id"], payment.event.id);
assert.equal(payment.headers["atm-api-version"], "2026-07");

const request = createAtmWebhookRequest(payment, {
  url: "https://app.example/webhooks/atm",
  headers: { "x-test-case": "payment" },
});
assert.equal(request.method, "POST");
assert.equal(request.headers.get("atm-event"), "payment.completed");
assert.equal(request.headers.get("x-test-case"), "payment");
assert.equal(await request.text(), payment.rawBody);

const verifiedPayment = constructTypedAtmWebhookEvent({
  rawBody: payment.rawBody,
  secret: ATM_TEST_WEBHOOK_SECRET,
  expectedType: "payment.completed",
  now: payment.signatureTimestamp,
  headers: {
    signature: payment.headers["atm-signature"],
    deliveryId: payment.headers["atm-delivery-id"],
    event: payment.headers["atm-event"],
    apiVersion: payment.headers["atm-api-version"],
    environment: payment.headers["atm-environment"],
  },
});
assert.equal(verifiedPayment.data.payment.metadata.appOrderId, "ord_test_fixture");

const genericArchived = createAtmEventFixture({
  type: "product.archived",
  data: {
    $type: "attacker.supplied#wrongType",
    product: {
      uri: "at://did:plc:creator/money.atmosphere.product/product_123",
    },
    creatorDid: "did:plc:creator",
  },
});
assert.equal(genericArchived.event.type, "product.archived");
assert.equal(genericArchived.event.data.$type, "money.atmosphere.event.receive#productArchived");
assert.equal(genericArchived.headers["atm-event"], "product.archived");
assert.equal(genericArchived.headers["atm-delivery-id"], genericArchived.event.id);

const paymentFailed = createPaymentFailedFixture();
assert.equal(paymentFailed.event.type, "payment.failed");
assert.equal(paymentFailed.event.data.payment.status, "failed");
assert.equal(paymentFailed.event.data.reason, "card_declined");

const paymentRefunded = createPaymentRefundedFixture({
  amount: 500,
  amountRefundedTotal: 500,
});
assert.equal(paymentRefunded.event.type, "payment.refunded");
assert.equal(paymentRefunded.event.data.amount, 500);
assert.equal(paymentRefunded.event.data.amountRefundedTotal, 500);
assert.equal(paymentRefunded.event.data.partial, true);

const paymentDisputed = createPaymentDisputedFixture({
  status: "under_review",
});
assert.equal(paymentDisputed.event.type, "payment.disputed");
assert.equal(paymentDisputed.event.data.status, "under_review");

const productArchivedDedicated = createProductArchivedFixture({
  creatorDid: "did:plc:creator",
});
assert.equal(productArchivedDedicated.event.type, "product.archived");
assert.equal(productArchivedDedicated.event.data.creatorDid, "did:plc:creator");
assert.equal(
  productArchivedDedicated.event.data.product.uri,
  "at://did:plc:creator/money.atmosphere.product/product_fixture"
);

const subscription = createSubscriptionUpdatedFixture();
assert.equal(subscription.event.type, "subscription.updated");
assert.equal(subscription.event.data.priorAmount, 500);
assert.equal(subscription.event.data.amount, 1500);
assert.equal(subscription.event.data.payment.amount, 1500);
assert.equal(subscription.event.data.updatedBy.actor, "payer");

const tickets = createTicketsIssuedFixture({
  issuance: {
    tickets: [
      {
        id: "ticket_one",
        eventId: "event_fixture_123",
        tierId: "tier_general",
        status: "issued",
      },
      {
        id: "ticket_two",
        eventId: "event_fixture_123",
        tierId: "tier_general",
        status: "issued",
      },
    ],
  },
});
assert.equal(tickets.event.type, "tickets.issued");
assert.equal(tickets.event.data.$type, "money.atmosphere.event.receive#ticketsIssued");
assert.equal(tickets.event.data.tickets.length, 2);
assert.equal(tickets.event.data.hold.id, "hold_fixture_123");

const checkedIn = createTicketCheckedInFixture({
  checkIn: { scannerDid: "did:plc:scanner" },
});
assert.equal(checkedIn.event.type, "ticket.checked-in");
assert.equal(checkedIn.event.data.ticket.id, "ticket_fixture_123");
assert.equal(checkedIn.event.data.checkIn.scannerDid, "did:plc:scanner");

const signature = signAtmFixture({
  rawBody: payment.rawBody,
  deliveryId: payment.headers["atm-delivery-id"],
  timestamp: payment.signatureTimestamp,
});
assert.equal(
  verifyAtmWebhookSignature({
    rawBody: payment.rawBody,
    signature,
    deliveryId: payment.headers["atm-delivery-id"],
    secret: ATM_TEST_WEBHOOK_SECRET,
    now: payment.signatureTimestamp,
  }),
  true
);

const verifiedRefund = constructTypedAtmWebhookEvent({
  rawBody: paymentRefunded.rawBody,
  secret: ATM_TEST_WEBHOOK_SECRET,
  expectedType: "payment.refunded",
  now: paymentRefunded.signatureTimestamp,
  headers: {
    signature: paymentRefunded.headers["atm-signature"],
    deliveryId: paymentRefunded.headers["atm-delivery-id"],
    event: paymentRefunded.headers["atm-event"],
    apiVersion: paymentRefunded.headers["atm-api-version"],
    environment: paymentRefunded.headers["atm-environment"],
  },
});
assert.equal(verifiedRefund.data.payment.id, "pay_fixture_refunded");

const replayStore = createMemoryReplayStore();
await assertFreshDelivery(replayStore, payment.headers["atm-delivery-id"]);
await assert.rejects(
  () => assertFreshDelivery(replayStore, payment.headers["atm-delivery-id"]),
  /Duplicate ATM delivery id/
);

const lifecycleStore = createMemoryDeliveryStore();
const firstClaim = lifecycleStore.claim("del_lifecycle_fixture");
assert.equal(firstClaim.status, "claimed");
if (firstClaim.status !== "claimed") throw new Error("expected claimed delivery");
assert.deepEqual(lifecycleStore.claim("del_lifecycle_fixture"), { status: "busy" });
assert.throws(
  () => lifecycleStore.complete("del_lifecycle_fixture", "stale-claim"),
  /stale or not owned/
);
lifecycleStore.release("del_lifecycle_fixture", firstClaim.claimId);
const retryClaim = lifecycleStore.claim("del_lifecycle_fixture");
assert.equal(retryClaim.status, "claimed");
if (retryClaim.status !== "claimed") throw new Error("expected retry claim");
assert.notEqual(retryClaim.claimId, firstClaim.claimId);
lifecycleStore.complete("del_lifecycle_fixture", retryClaim.claimId);
assert.equal(lifecycleStore.getStatus("del_lifecycle_fixture"), "completed");
assert.deepEqual(lifecycleStore.claim("del_lifecycle_fixture"), {
  status: "completed",
});

const handlerStore = createMemoryDeliveryStore();
let fulfillmentCount = 0;
const handler = createNodeWebhookHandler({
  secret: ATM_TEST_WEBHOOK_SECRET,
  expectedType: "payment.completed",
  now: payment.signatureTimestamp,
  deliveryStore: handlerStore,
  onEvent: () => {
    fulfillmentCount += 1;
    return { status: 200 };
  },
});
assert.equal((await handler(createAtmWebhookRequest(payment))).status, 200);
assert.equal((await handler(createAtmWebhookRequest(payment))).status, 200);
assert.equal(fulfillmentCount, 1);

const retryFixture = createPaymentCompletedFixture({
  deliveryId: "del_retryable_failure_fixture",
});
const retryStore = createMemoryDeliveryStore();
let retryAttempts = 0;
const retryHandler = createNodeWebhookHandler({
  secret: ATM_TEST_WEBHOOK_SECRET,
  expectedType: "payment.completed",
  now: retryFixture.signatureTimestamp,
  deliveryStore: retryStore,
  onEvent: () => {
    retryAttempts += 1;
    if (retryAttempts === 1) throw new Error("temporary fulfillment failure");
    return { status: 200 };
  },
});
assert.equal((await retryHandler(createAtmWebhookRequest(retryFixture))).status, 500);
assert.equal(retryStore.getStatus(retryFixture.event.id), undefined);
assert.equal((await retryHandler(createAtmWebhookRequest(retryFixture))).status, 200);
assert.equal(retryStore.getStatus(retryFixture.event.id), "completed");
assert.equal(retryAttempts, 2);

assert.equal(
  createAtmIdempotencyKey(["order", "ord_123", "buyer", "did:plc:buyer"]),
  "atm:test:order:ord_123:buyer:did:plc:buyer"
);
assert.throws(() => createAtmIdempotencyKey([]), /At least one/);

// The generic builder must fixture every documented event type.
const payerClaimed = createAtmEventFixture({
  type: "payer.claimed",
  data: {
    did: "did:plc:buyer",
    paymentIds: ["pay_fixture_123"],
    claimedAt: "2026-07-01T12:00:00.000Z",
  },
});
assert.equal(payerClaimed.event.type, "payer.claimed");
assert.equal(
  payerClaimed.event.data.$type,
  "money.atmosphere.event.receive#payerClaimed"
);

// Contract coverage: in the ATM monorepo, assert the fixture event-type union
// and $type map exactly cover the published money.atmosphere.event.receive
// contract (knownValues + the data union refs, which are index-aligned). The
// public atm-js mirror ships without app/lexicons — skip there.
const receiveLexiconPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../app/lexicons/money/atmosphere/event/receive.json"
);
if (existsSync(receiveLexiconPath)) {
  const receive = JSON.parse(readFileSync(receiveLexiconPath, "utf8")) as {
    defs: {
      eventType: { knownValues: string[] };
      main: {
        input: { schema: { properties: { data: { refs: string[] } } } };
      };
    };
  };
  const knownValues = receive.defs.eventType.knownValues;
  const refs = receive.defs.main.input.schema.properties.data.refs;
  assert.equal(knownValues.length, refs.length);
  assert.deepEqual(
    Object.keys(ATM_TEST_EVENT_PAYLOAD_TYPES).sort(),
    [...knownValues].sort()
  );
  for (let i = 0; i < knownValues.length; i += 1) {
    const eventType = knownValues[i] as keyof typeof ATM_TEST_EVENT_PAYLOAD_TYPES;
    assert.equal(
      ATM_TEST_EVENT_PAYLOAD_TYPES[eventType],
      `money.atmosphere.event.receive${refs[i]}`,
      `payload $type mismatch for ${eventType}`
    );
  }
  console.log(
    `Lexicon coverage check passed for ${knownValues.length} event types.`
  );
}

console.log("ATM testing package checks passed.");
