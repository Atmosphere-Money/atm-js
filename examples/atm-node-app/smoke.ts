import {
  signAtmWebhookPayload,
  verifyAtmWebhookSignature,
} from "@atmosphere-money/app-node";

const secret = "whsec_test_secret";
const deliveryId = "del_test";
const timestamp = 1_770_000_000;
const rawBody = JSON.stringify({
  id: deliveryId,
  environment: "test",
  type: "payment.completed",
  createdAt: new Date(timestamp * 1000).toISOString(),
  apiVersion: "2026-07",
  data: { payment: { id: "pmt_test", amount: 500, currency: "usd" } },
});

const signature = signAtmWebhookPayload({
  rawBody,
  deliveryId,
  secret,
  timestamp,
});

if (
  !verifyAtmWebhookSignature({
    rawBody,
    signature,
    deliveryId,
    secret,
    now: timestamp,
  })
) {
  throw new Error("ATM signature smoke check failed");
}

console.log("ATM example smoke check passed.");
