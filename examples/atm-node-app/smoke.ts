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
  created: timestamp,
  apiVersion: "2026-05",
  data: { payment: { id: "pmt_test", amountCents: 500, currency: "usd" } },
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
