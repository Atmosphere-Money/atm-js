import assert from "node:assert/strict";
import {
  ATM_TEST_WEBHOOK_SECRET,
  assertFreshDelivery,
  createAtmIdempotencyKey,
  createAtmEventFixture,
  createAtmWebhookRequest,
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
  constructTypedAtmWebhookEvent,
  verifyAtmWebhookSignature,
} from "../../app-node/src/index";

const payment = createPaymentCompletedFixture({
  payment: {
    id: "pay_test_fixture",
    amountCents: 2500,
    metadata: { appOrderId: "ord_test_fixture" },
  },
});

assert.equal(payment.event.type, "payment.completed");
assert.equal(payment.event.data.payment.id, "pay_test_fixture");
assert.equal(payment.headers["atm-delivery-id"], payment.event.id);

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
  now: payment.event.created,
  headers: {
    signature: payment.headers["atm-signature"],
    deliveryId: payment.headers["atm-delivery-id"],
    event: payment.headers["atm-event"],
    apiVersion: payment.headers["atm-api-version"],
    environment: payment.headers["atm-environment"],
  },
});
assert.equal(verifiedPayment.data.payment.metadata.appOrderId, "ord_test_fixture");

const productArchived = createAtmEventFixture({
  type: "product.archived",
  data: {
    productUri: "at://did:plc:creator/money.atmosphere.product/product_123",
    appDid: "did:plc:app",
  },
});
assert.equal(productArchived.event.type, "product.archived");
assert.equal(productArchived.headers["atm-event"], "product.archived");
assert.equal(productArchived.headers["atm-delivery-id"], productArchived.event.id);

const paymentFailed = createPaymentFailedFixture();
assert.equal(paymentFailed.event.type, "payment.failed");
assert.equal(paymentFailed.event.data.payment.status, "failed");
assert.equal(paymentFailed.event.data.payment.failureCode, "card_declined");

const paymentRefunded = createPaymentRefundedFixture({
  payment: { refundedAmountCents: 500 },
});
assert.equal(paymentRefunded.event.type, "payment.refunded");
assert.equal(paymentRefunded.event.data.payment.refundedAmountCents, 500);

const paymentDisputed = createPaymentDisputedFixture({
  payment: { disputeStatus: "under_review" },
});
assert.equal(paymentDisputed.event.type, "payment.disputed");
assert.equal(paymentDisputed.event.data.payment.disputeStatus, "under_review");

const productArchivedDedicated = createProductArchivedFixture({
  product: { creatorDid: "did:plc:creator" },
});
assert.equal(productArchivedDedicated.event.type, "product.archived");
assert.equal(productArchivedDedicated.event.data.product.creatorDid, "did:plc:creator");

const subscription = createSubscriptionUpdatedFixture();
assert.equal(subscription.event.type, "subscription.updated");
assert.equal(subscription.event.data.subscription.previousAmountCents, 500);

const tickets = createTicketsIssuedFixture({
  ticket: {
    issuedCount: 2,
    tickets: [
      {
        ticketId: "ticket_one",
        ticketTierId: "tier_general",
        status: "issued",
      },
      {
        ticketId: "ticket_two",
        ticketTierId: "tier_general",
        status: "issued",
      },
    ],
  },
});
assert.equal(tickets.event.type, "tickets.issued");
assert.equal(tickets.event.data.issuedCount, 2);

const checkedIn = createTicketCheckedInFixture({
  ticket: { repeat: true, buyerDid: "did:plc:buyer" },
});
assert.equal(checkedIn.event.type, "ticket.checked_in");
assert.equal(checkedIn.event.data.ticket.repeat, true);
assert.equal(checkedIn.event.data.ticket.buyerDid, "did:plc:buyer");

const signature = signAtmFixture({
  rawBody: payment.rawBody,
  deliveryId: payment.headers["atm-delivery-id"],
  timestamp: payment.event.created,
});
assert.equal(
  verifyAtmWebhookSignature({
    rawBody: payment.rawBody,
    signature,
    deliveryId: payment.headers["atm-delivery-id"],
    secret: ATM_TEST_WEBHOOK_SECRET,
    now: payment.event.created,
  }),
  true
);

const verifiedRefund = constructTypedAtmWebhookEvent({
  rawBody: paymentRefunded.rawBody,
  secret: ATM_TEST_WEBHOOK_SECRET,
  expectedType: "payment.refunded",
  now: paymentRefunded.event.created,
  headers: {
    signature: paymentRefunded.headers["atm-signature"],
    deliveryId: paymentRefunded.headers["atm-delivery-id"],
    event: paymentRefunded.headers["atm-event"],
    apiVersion: paymentRefunded.headers["atm-api-version"],
    environment: paymentRefunded.headers["atm-environment"],
  },
});
assert.equal(verifiedRefund.data.payment.refundId, "ref_fixture_123");

const replayStore = createMemoryReplayStore();
await assertFreshDelivery(replayStore, payment.headers["atm-delivery-id"]);
await assert.rejects(
  () => assertFreshDelivery(replayStore, payment.headers["atm-delivery-id"]),
  /Duplicate ATM delivery id/
);

assert.equal(
  createAtmIdempotencyKey(["order", "ord_123", "buyer", "did:plc:buyer"]),
  "atm:test:order:ord_123:buyer:did:plc:buyer"
);
assert.throws(() => createAtmIdempotencyKey([]), /At least one/);

console.log("ATM testing package checks passed.");
