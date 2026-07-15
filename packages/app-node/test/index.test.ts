import assert from "node:assert/strict";
import {
  ATM_BROKER_DID,
  ATM_EVENT_RECEIVE_NSID,
  ATM_CHECKOUT_PRODUCT_PREFIX,
  ATM_XRPC_METHODS,
  AtmApiError,
  AtmWebhookSignatureError,
  AtmXrpcReceiverAuthError,
  constructAtmWebhookEvent,
  constructTypedAtmWebhookEvent,
  constructAtmXrpcReceiverEvent,
  constructTypedAtmXrpcReceiverEvent,
  createAtmAppClient,
  createAtmCheckoutProduct,
  createAtmXrpcReceiverAudience,
  createCloudflareWorkerWebhookHandler,
  createExpressWebhookHandler,
  createFreeTicketClaimBody,
  createHonoWebhookHandler,
  createNextWebhookRoute,
  createNodeWebhookHandler,
  createPaymentInitiateBody,
  createTicketHoldBody,
  signAtmWebhookPayload,
  verifyAtmWebhookSignature,
  verifyAtmReceiverServiceAuthClaims,
  verifyServiceAuthRequest,
  inspectAtmAttestationRefs,
  type AtmPayerClaimedEventData,
  type AtmProductEventData,
  type AtmTicketSummary,
} from "../src/index";

const ticketWireShape = {
  id: "ticket_contract",
  tierId: "tier_contract",
} satisfies AtmTicketSummary;
const productWireShape = {
  product: {
    uri: "at://did:plc:creator/money.atmosphere.product/product_contract",
    cid: "bafycontract",
  },
  creatorDid: "did:plc:creator",
} satisfies AtmProductEventData;
const payerClaimedWireShape = {
  did: "did:plc:buyer",
  paymentIds: ["pay_contract"],
  claimedAt: "2026-07-01T12:00:00.000Z",
} satisfies AtmPayerClaimedEventData;
assert.equal(ticketWireShape.tierId, "tier_contract");
assert.equal(productWireShape.product.cid, "bafycontract");
assert.deepEqual(payerClaimedWireShape.paymentIds, ["pay_contract"]);

const envelope = {
  recipient: "did:plc:creator",
  amount: 500,
  currency: "usd",
  paymentType: "shop" as const,
  environment: "test" as const,
  idempotencyKey: "shop:order/attempt-1",
  checkoutExpiresAt: "2026-07-12T13:00:00.000Z",
  payerDid: "did:plc:buyer",
  payerAssertionJwt: "payer-service-auth-jwt",
  metadata: {
    appOrderId: "ord_123",
    ignored: undefined,
  },
  subscriptionPolicy: {
    activeLimit: "one_per_payer_recipient" as const,
  },
  subscriptionGroupKey: "membership:creator-research",
  listing: {
    $type: "com.atproto.repo.strongRef" as const,
    uri: "at://did:plc:creator/money.atmosphere.product/abc",
    cid: "bafyabc",
  },
};

const product = createAtmCheckoutProduct(envelope);
assert.equal(product.startsWith(ATM_CHECKOUT_PRODUCT_PREFIX), true);

const decoded = JSON.parse(
  Buffer.from(product.slice(ATM_CHECKOUT_PRODUCT_PREFIX.length), "base64url").toString("utf8")
);
assert.equal(decoded.recipient, "did:plc:creator");
assert.equal(decoded.amount, 500);
assert.equal(decoded.idempotencyKey, "shop:order/attempt-1");
assert.equal(decoded.checkoutExpiresAt, "2026-07-12T13:00:00.000Z");
assert.equal(decoded.metadata.appOrderId, "ord_123");
assert.equal("ignored" in decoded.metadata, false);
assert.equal(decoded.subscriptionPolicy.activeLimit, "one_per_payer_recipient");
assert.equal(decoded.subscriptionGroupKey, "membership:creator-research");
assert.equal(decoded.listing.cid, "bafyabc");
const legacyEmailProduct = createAtmCheckoutProduct({
  ...envelope,
  customerEmail: "untrusted@example.com",
} as typeof envelope & { customerEmail: string });
const legacyEmailDecoded = JSON.parse(
  Buffer.from(
    legacyEmailProduct.slice(ATM_CHECKOUT_PRODUCT_PREFIX.length),
    "base64url"
  ).toString("utf8")
);
assert.equal("customerEmail" in legacyEmailDecoded, false);

assert.deepEqual(createPaymentInitiateBody(envelope), { product });
assert.throws(
  () => createAtmCheckoutProduct({ ...envelope, recipient: "alice.test" }),
  /recipient must be a DID/
);
assert.throws(
  () => createAtmCheckoutProduct({ ...envelope, payerAssertionJwt: undefined }),
  /payerDid and payerAssertionJwt must be supplied together/
);
assert.throws(
  () => createAtmCheckoutProduct({ ...envelope, idempotencyKey: "bad key" }),
  /idempotencyKey/
);
assert.throws(
  () => createAtmCheckoutProduct({ ...envelope, checkoutExpiresAt: "tomorrow" }),
  /checkoutExpiresAt/
);

const calls: Array<{ url: string; init?: RequestInit }> = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  calls.push({ url: String(url), init });
  return new Response(JSON.stringify({ ok: true, url: String(url) }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch;

const error = new AtmApiError("BadThing", "Nope", 400, { error: "BadThing" });
assert.equal(error.name, "AtmApiError");
assert.equal(error.code, "BadThing");
assert.equal(error.status, 400);

const webhookBody = JSON.stringify({
  id: "whd_test",
  type: "payment.completed",
  createdAt: "2026-05-17T12:00:00.000Z",
  apiVersion: "2026-06",
  environment: "test",
  data: {
    $type: "money.atmosphere.event.receive#paymentCompleted",
    payment: {
      id: "pmt_test",
      amount: 500,
      currency: "usd",
      status: "completed",
    },
  },
});
const webhookSecret = "atm_whsec_test";
const webhookTimestamp = 1_779_000_000;
const signature = signAtmWebhookPayload({
  rawBody: webhookBody,
  deliveryId: "whd_test",
  secret: webhookSecret,
  timestamp: webhookTimestamp,
});
const rotatedSignature = `${signAtmWebhookPayload({
  rawBody: webhookBody,
  deliveryId: "whd_test",
  secret: "atm_whsec_previous",
  timestamp: webhookTimestamp,
})},${signature.split(",")[1]}`;
assert.equal(
  verifyAtmWebhookSignature({
    rawBody: webhookBody,
    deliveryId: "whd_test",
    secret: webhookSecret,
    signature,
    now: webhookTimestamp,
  }),
  true
);
assert.equal(
  verifyAtmWebhookSignature({
    rawBody: webhookBody,
    deliveryId: "whd_test",
    secret: ["atm_whsec_missing", webhookSecret],
    signature: rotatedSignature,
    now: webhookTimestamp,
  }),
  true
);
assert.equal(
  verifyAtmWebhookSignature({
    rawBody: `${webhookBody} `,
    deliveryId: "whd_test",
    secret: webhookSecret,
    signature,
    now: webhookTimestamp,
  }),
  false
);
assert.equal(
  verifyAtmWebhookSignature({
    rawBody: webhookBody,
    deliveryId: "whd_other",
    secret: webhookSecret,
    signature,
    now: webhookTimestamp,
  }),
  false
);
assert.equal(
  verifyAtmWebhookSignature({
    rawBody: webhookBody,
    deliveryId: "whd_test",
    secret: webhookSecret,
    signature,
    now: webhookTimestamp + 301,
  }),
  false
);
const webhookEvent = constructAtmWebhookEvent<{
  payment: { id: string; amount: number; currency: string; status: string };
}>({
  rawBody: webhookBody,
  secret: webhookSecret,
  now: webhookTimestamp,
  headers: {
    signature,
    deliveryId: "whd_test",
    event: "payment.completed",
    apiVersion: "2026-06",
    environment: "test",
  },
});
assert.equal(webhookEvent.id, "whd_test");
assert.equal(webhookEvent.type, "payment.completed");
assert.equal(webhookEvent.data.payment.id, "pmt_test");
const typedWebhookEvent = constructTypedAtmWebhookEvent({
  rawBody: webhookBody,
  secret: webhookSecret,
  now: webhookTimestamp,
  expectedType: "payment.completed",
  headers: {
    signature,
    deliveryId: "whd_test",
    apiVersion: "2026-06",
    environment: "test",
  },
});
assert.equal(typedWebhookEvent.data.payment.id, "pmt_test");

const deliveryStates = new Map<string, "processing" | "completed">();
const deliveryStore = {
  claim(deliveryId: string) {
    const state = deliveryStates.get(deliveryId);
    if (state === "completed") return { status: "completed" } as const;
    if (state === "processing") return { status: "busy" } as const;
    deliveryStates.set(deliveryId, "processing");
    return { status: "claimed", claimId: `claim:${deliveryId}` } as const;
  },
  complete(deliveryId: string) {
    deliveryStates.set(deliveryId, "completed");
  },
  release(deliveryId: string) {
    if (deliveryStates.get(deliveryId) === "processing") {
      deliveryStates.delete(deliveryId);
    }
  },
};

const nodeWebhookHandler = createNodeWebhookHandler({
  secret: webhookSecret,
  expectedType: "payment.completed",
  now: webhookTimestamp,
  deliveryStore,
  onEvent: async (event) => {
    assert.equal(event.data.payment.id, "pmt_test");
    return { status: 202, body: { accepted: true, id: event.id } };
  },
});
const nodeWebhookResponse = await nodeWebhookHandler(
  new Request("https://app.example/webhooks/atm", {
    method: "POST",
    body: webhookBody,
    headers: {
      "atm-signature": signature,
      "atm-delivery-id": "whd_test",
      "atm-event": "payment.completed",
      "atm-api-version": "2026-06",
      "atm-environment": "test",
    },
  })
);
assert.equal(nodeWebhookResponse.status, 202);
assert.equal((await nodeWebhookResponse.json() as { accepted: boolean }).accepted, true);
assert.equal(deliveryStates.get("whd_test"), "completed");

const honoWebhookHandler = createHonoWebhookHandler({
  secret: webhookSecret,
  expectedType: "payment.completed",
  now: webhookTimestamp,
  onEvent: (event) => ({ body: { paymentId: event.data.payment.id } }),
});
const honoWebhookResponse = await honoWebhookHandler({
  req: {
    raw: new Request("https://app.example/webhooks/atm", {
      method: "POST",
      body: webhookBody,
      headers: {
        "atm-signature": signature,
        "atm-delivery-id": "whd_test",
        "atm-event": "payment.completed",
      },
    }),
  },
});
assert.equal(honoWebhookResponse.status, 200);
assert.equal(
  (await honoWebhookResponse.json() as { paymentId: string }).paymentId,
  "pmt_test"
);

const cloudflareWebhookHandler = createCloudflareWorkerWebhookHandler({
  secret: webhookSecret,
  expectedType: "payment.completed",
  now: webhookTimestamp,
  onEvent: (event) => ({ body: { paymentId: event.data.payment.id } }),
});
const cloudflareWebhookResponse = await cloudflareWebhookHandler.fetch(
  new Request("https://app.example/webhooks/atm", {
    method: "POST",
    body: webhookBody,
    headers: {
      "atm-signature": signature,
      "atm-delivery-id": "whd_test",
      "atm-event": "payment.completed",
    },
  })
);
assert.equal(cloudflareWebhookResponse.status, 200);
assert.equal(
  (await cloudflareWebhookResponse.json() as { paymentId: string }).paymentId,
  "pmt_test"
);

const duplicateWebhookHandler = createNextWebhookRoute({
  secret: webhookSecret,
  expectedType: "payment.completed",
  now: webhookTimestamp,
  deliveryStore,
  onEvent: () => {
    throw new Error("duplicate deliveries should not reach onEvent");
  },
});
const duplicateWebhookResponse = await duplicateWebhookHandler(
  new Request("https://app.example/webhooks/atm", {
    method: "POST",
    body: webhookBody,
    headers: {
      "atm-signature": signature,
      "atm-delivery-id": "whd_test",
      "atm-event": "payment.completed",
    },
  })
);
assert.equal(duplicateWebhookResponse.status, 200);
assert.equal(
  (await duplicateWebhookResponse.json() as { duplicate: boolean }).duplicate,
  true
);

let busyHandlerCalled = false;
const busyWebhookHandler = createNextWebhookRoute({
  secret: webhookSecret,
  expectedType: "payment.completed",
  now: webhookTimestamp,
  deliveryStore: {
    claim: () => ({ status: "busy" }),
    complete: () => undefined,
    release: () => undefined,
  },
  onEvent: () => {
    busyHandlerCalled = true;
  },
});
const busyWebhookResponse = await busyWebhookHandler(
  new Request("https://app.example/webhooks/atm", {
    method: "POST",
    body: webhookBody,
    headers: {
      "atm-signature": signature,
      "atm-delivery-id": "whd_test",
      "atm-event": "payment.completed",
    },
  })
);
assert.equal(busyWebhookResponse.status, 503);
assert.equal(busyWebhookResponse.headers.get("retry-after"), "1");
assert.equal(busyHandlerCalled, false);

let retryAttempt = 0;
const retryDeliveryStates = new Map<string, "processing" | "completed">();
const retryWebhookHandler = createNodeWebhookHandler({
  secret: webhookSecret,
  expectedType: "payment.completed",
  now: webhookTimestamp,
  deliveryStore: {
    claim(deliveryId) {
      const state = retryDeliveryStates.get(deliveryId);
      if (state === "completed") return { status: "completed" } as const;
      if (state === "processing") return { status: "busy" } as const;
      retryDeliveryStates.set(deliveryId, "processing");
      return { status: "claimed", claimId: `retry:${deliveryId}` } as const;
    },
    complete(deliveryId) {
      retryDeliveryStates.set(deliveryId, "completed");
    },
    release(deliveryId) {
      retryDeliveryStates.delete(deliveryId);
    },
  },
  onEvent: () => {
    retryAttempt += 1;
    if (retryAttempt === 1) {
      return { status: 503, body: { error: "TryAgain" } };
    }
    return { body: { ok: true } };
  },
});
const retryRequest = () =>
  new Request("https://app.example/webhooks/atm", {
    method: "POST",
    body: webhookBody,
    headers: {
      "atm-signature": signature,
      "atm-delivery-id": "whd_test",
      "atm-event": "payment.completed",
    },
  });
assert.equal((await retryWebhookHandler(retryRequest())).status, 503);
assert.equal(retryDeliveryStates.has("whd_test"), false);
assert.equal((await retryWebhookHandler(retryRequest())).status, 200);
assert.equal(retryDeliveryStates.get("whd_test"), "completed");
assert.equal(retryAttempt, 2);

let thrownAttempt = 0;
let thrownReleases = 0;
let thrownCompletions = 0;
const thrownRetryHandler = createNodeWebhookHandler({
  secret: webhookSecret,
  expectedType: "payment.completed",
  now: webhookTimestamp,
  deliveryStore: {
    claim: () => ({ status: "claimed", claimId: "throw-retry" }),
    complete: () => {
      thrownCompletions += 1;
    },
    release: () => {
      thrownReleases += 1;
    },
  },
  onEvent: () => {
    thrownAttempt += 1;
    if (thrownAttempt === 1) throw new Error("transient fulfillment failure");
    return { body: { ok: true } };
  },
});
assert.equal((await thrownRetryHandler(retryRequest())).status, 500);
assert.equal(thrownReleases, 1);
assert.equal((await thrownRetryHandler(retryRequest())).status, 200);
assert.equal(thrownCompletions, 1);
assert.equal(thrownAttempt, 2);

let expressStatus = 0;
let expressBody: unknown = null;
const expressWebhookHandler = createExpressWebhookHandler({
  secret: webhookSecret,
  expectedType: "payment.completed",
  now: webhookTimestamp,
  onEvent: (event) => ({ body: { ok: true, paymentId: event.data.payment.id } }),
});
await expressWebhookHandler(
  {
    rawBody: webhookBody,
    headers: {
      "atm-signature": signature,
      "atm-delivery-id": "whd_test",
      "atm-event": "payment.completed",
    },
  },
  {
    status(code) {
      expressStatus = code;
      return this;
    },
    json(body) {
      expressBody = body;
    },
  }
);
assert.equal(expressStatus, 200);
assert.deepEqual(expressBody, { ok: true, paymentId: "pmt_test" });

assert.equal(
  ATM_XRPC_METHODS.tickets.createTicketHold,
  "tickets.atmosphere.createTicketHold"
);
assert.equal(
  createAtmXrpcReceiverAudience("did:plc:app"),
  "did:plc:app#AtmEventReceiver"
);
assert.equal(
  createAtmXrpcReceiverAudience("did:plc:app", "CustomReceiver"),
  "did:plc:app#CustomReceiver"
);
assert.throws(
  () => createAtmXrpcReceiverAudience("at://did:plc:app", "#AtmEventReceiver"),
  /appDid must be a DID/
);
assert.deepEqual(
  createTicketHoldBody({
    environment: "test",
    eventUri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
    buyerDid: "did:plc:buyer",
    buyerAssertionJwt: "buyer.assertion.jwt",
    items: [{ tierId: "tier_demo", quantity: 2 }],
    metadata: { omitMe: undefined },
  }),
  {
    environment: "test",
    eventUri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
    buyerDid: "did:plc:buyer",
    buyerAssertionJwt: "buyer.assertion.jwt",
    items: [{ tierId: "tier_demo", quantity: 2 }],
    metadata: {},
  }
);
assert.throws(
  () =>
    createTicketHoldBody({
      buyerDid: "did:plc:buyer",
      items: [{ tierId: "tier_demo", quantity: 1 }],
    }),
  /buyerDid and buyerAssertionJwt must be supplied together/
);
assert.throws(
  () =>
    createTicketHoldBody({
      items: [{ tierId: "tier_demo", quantity: 0 }],
    }),
  /positive integer/
);
assert.deepEqual(
  createFreeTicketClaimBody({
    environment: "test",
    tierId: "tier_free",
    buyerDid: "did:plc:buyer",
    buyerAssertionJwt: "buyer.assertion.jwt",
  }),
  {
    environment: "test",
    tierId: "tier_free",
    buyerDid: "did:plc:buyer",
    buyerAssertionJwt: "buyer.assertion.jwt",
  }
);
assert.throws(
  () =>
    createFreeTicketClaimBody({
      tierId: "tier_free",
      buyerDid: "did:plc:buyer",
      buyerAssertionJwt: "",
    }),
  /buyerAssertionJwt/
);
assert.throws(
  () =>
    constructAtmWebhookEvent({
      rawBody: webhookBody,
      secret: webhookSecret,
      now: webhookTimestamp,
      headers: {
        signature,
        deliveryId: "whd_other",
      },
    }),
  AtmWebhookSignatureError
);

const xrpcClaims = {
  iss: ATM_BROKER_DID,
  aud: "did:plc:app#AtmEventReceiver",
  lxm: ATM_EVENT_RECEIVE_NSID,
  exp: webhookTimestamp + 60,
  iat: webhookTimestamp,
  jti: "jti_123",
};
verifyAtmReceiverServiceAuthClaims({
  claims: xrpcClaims,
  expectedIss: ATM_BROKER_DID,
  expectedAud: "did:plc:app#AtmEventReceiver",
  expectedLxm: ATM_EVENT_RECEIVE_NSID,
});
const verifiedServiceAuthClaims = await verifyServiceAuthRequest({
  request: new Request("https://app.example/xrpc/money.atmosphere.event.receive", {
    headers: { authorization: "Bearer atm-service-auth-jwt" },
  }),
  expectedIss: ATM_BROKER_DID,
  expectedAud: "did:plc:app#AtmEventReceiver",
  expectedLxm: ATM_EVENT_RECEIVE_NSID,
  verifyServiceAuthJwt: ({ token, expectedIss, expectedAud, expectedLxm }) => {
    assert.equal(token, "atm-service-auth-jwt");
    return {
      iss: expectedIss,
      aud: expectedAud,
      lxm: expectedLxm,
      exp: webhookTimestamp + 60,
      jti: "jti_service_auth",
    };
  },
});
assert.equal(verifiedServiceAuthClaims.jti, "jti_service_auth");
await assert.rejects(
  () =>
    verifyServiceAuthRequest({
      request: new Request("https://app.example/xrpc/money.atmosphere.event.receive"),
      expectedIss: ATM_BROKER_DID,
      expectedAud: "did:plc:app#AtmEventReceiver",
      expectedLxm: ATM_EVENT_RECEIVE_NSID,
      verifyServiceAuthJwt: () => xrpcClaims,
    }),
  AtmXrpcReceiverAuthError
);
assert.throws(
  () =>
    verifyAtmReceiverServiceAuthClaims({
      claims: { ...xrpcClaims, iss: "did:plc:someoneelse" },
      expectedIss: ATM_BROKER_DID,
      expectedAud: "did:plc:app#AtmEventReceiver",
      expectedLxm: ATM_EVENT_RECEIVE_NSID,
    }),
  AtmXrpcReceiverAuthError
);

async function main() {
  try {
    const client = createAtmAppClient({
      brokerUrl: "https://checkout.atmosphere.money/",
      getServiceAuthToken: ({ lxm, aud }) => `jwt:${lxm}:${aud}`,
    });
    await client.getPayoutStatus("did:plc:creator");
    await client.initiatePayment(envelope);
    await client.createTicketEvent({
      environment: "test",
      organizerDid: "did:plc:organizer",
      event: {
        uri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
        title: "Demo event",
        startsAt: "2026-08-20T23:00:00.000Z",
      },
      status: "active",
    });
    await client.updateTicketEvent({
      environment: "test",
      eventId: "event_demo",
      title: "Updated demo event",
      status: "active",
    });
    await client.createCapacityGroup({
      environment: "test",
      organizerDid: "did:plc:organizer",
      event: {
        uri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
        title: "Demo event",
      },
      name: "Demo capacity",
      totalCapacity: 100,
    });
    await client.updateCapacityGroup({
      environment: "test",
      capacityGroupId: "cap_demo",
      totalCapacity: 120,
    });
    await client.createTicketTier({
      environment: "test",
      organizerDid: "did:plc:organizer",
      event: {
        uri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
        title: "Demo event",
      },
      title: "General admission",
      currency: "usd",
      unitAmount: 2500,
      quantityTotal: 100,
    });
    await client.updateTicketTier({
      environment: "test",
      tierId: "tier_demo",
      title: "General admission updated",
    });
    await client.archiveTicketTier({
      environment: "test",
      tierId: "tier_demo",
    });
    await client.getTicketAvailability({
      environment: "test",
      eventUri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
    });
    await client.createTicketHold({
      environment: "test",
      eventUri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
      buyerDid: "did:plc:buyer",
      buyerAssertionJwt: "buyer.assertion.jwt",
      items: [{ tierId: "tier_demo", quantity: 1 }],
      returnUrl: "https://app.example/tickets/return",
      cancelUrl: "https://app.example/events/demo",
    });
    await client.releaseTicketHold({
      environment: "test",
      holdId: "hold_demo",
      reason: "buyer_cancelled",
    });
    await client.claimFreeTicket({
      environment: "test",
      eventUri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
      tierId: "tier_free",
      buyerDid: "did:plc:buyer",
      buyerAssertionJwt: "buyer.assertion.jwt",
      idempotencyKey: "claim:demo",
    });
    await client.listBuyerTickets({
      environment: "test",
      buyerDid: "did:plc:buyer",
      limit: 10,
    });
    await client.listOrganizerTickets({
      environment: "test",
      organizerDid: "did:plc:organizer",
      limit: 25,
    });
    await client.verifyTicket({
      environment: "test",
      ticketToken: "opaque_scan_token",
    });
    await client.checkInTicket({
      environment: "test",
      ticketToken: "opaque_scan_token",
      checkInListId: "list_demo",
    });
    await client.createProduct({
      environment: "test",
      title: "Pro publishing plan",
      kind: "membership",
      description: "Advanced publishing tools for app subscribers.",
      price: {
        currency: "usd",
        unitAmount: 1900,
        type: "recurring",
        recurring: { interval: "month" },
      },
      appProductRef: { type: "membership", id: "pro" },
      fulfillmentUrl: "https://app.example/billing/pro",
    });
    await client.updateProduct({
      environment: "test",
      product: {
        $type: "com.atproto.repo.strongRef",
        uri: "at://did:plc:app/money.atmosphere.product/pro",
        cid: "bafyproduct",
      },
      title: "Pro publishing plan plus",
      price: {
        currency: "usd",
        unitAmount: 2900,
        type: "recurring",
        recurring: { interval: "month" },
      },
      appProductRef: { type: "membership", id: "pro" },
    });
    assert.equal(calls.length, 19);
    assert.equal(
      calls[0].url,
      "https://checkout.atmosphere.money/xrpc/money.atmosphere.actor.getPayoutStatus?actor=did%3Aplc%3Acreator"
    );
    assert.equal(
      calls[1].url,
      "https://checkout.atmosphere.money/xrpc/network.attested.payment.initiate"
    );
    assert.match(
      String((calls[1].init?.headers as Record<string, string>).authorization),
      /^Bearer jwt:network\.attested\.payment\.initiate:/
    );
    assert.equal(
      calls[2].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.createTicketEvent"
    );
    assert.equal(
      calls[3].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.updateTicketEvent"
    );
    assert.equal(
      calls[4].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.createCapacityGroup"
    );
    assert.equal(
      calls[5].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.updateCapacityGroup"
    );
    assert.equal(
      calls[6].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.createTicketTier"
    );
    assert.equal(
      calls[7].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.updateTicketTier"
    );
    assert.equal(
      calls[8].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.archiveTicketTier"
    );
    assert.equal(
      calls[9].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.getTicketAvailability?environment=test&eventUri=at%3A%2F%2Fdid%3Aplc%3Aorganizer%2Fcommunity.lexicon.calendar.event%2Fdemo"
    );
    assert.equal(
      calls[10].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.createTicketHold"
    );
    assert.match(String(calls[10].init?.body), /"tierId":"tier_demo"/);
    assert.equal(
      calls[11].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.releaseTicketHold"
    );
    assert.equal(
      calls[12].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.claimFreeTicket"
    );
    assert.match(String(calls[12].init?.body), /"tierId":"tier_free"/);
    assert.equal(
      calls[13].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.listBuyerTickets?environment=test&buyerDid=did%3Aplc%3Abuyer&limit=10"
    );
    assert.equal(
      calls[14].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.listOrganizerTickets?environment=test&organizerDid=did%3Aplc%3Aorganizer&limit=25"
    );
    assert.equal(
      calls[15].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.verifyTicket"
    );
    assert.equal(
      calls[16].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.checkInTicket"
    );
    assert.equal(
      calls[17].url,
      "https://checkout.atmosphere.money/xrpc/money.atmosphere.catalog.createProduct"
    );
    assert.match(
      String((calls[17].init?.headers as Record<string, string>).authorization),
      /^Bearer jwt:money\.atmosphere\.catalog\.createProduct:/
    );
    assert.match(String(calls[17].init?.body), /"kind":"membership"/);
    assert.match(String(calls[17].init?.body), /"type":"recurring"/);
    assert.equal(
      calls[18].url,
      "https://checkout.atmosphere.money/xrpc/money.atmosphere.catalog.updateProduct"
    );
    assert.match(
      String((calls[18].init?.headers as Record<string, string>).authorization),
      /^Bearer jwt:money\.atmosphere\.catalog\.updateProduct:/
    );
    assert.match(String(calls[18].init?.body), /"unitAmount":2900/);

    const receiverEvent = await constructAtmXrpcReceiverEvent<{
      payment: { id: string; amount: number; currency: string; status: string };
    }>({
      rawBody: webhookBody,
      appDid: "did:plc:app",
      headers: {
        authorization: "Bearer atm-service-auth-jwt",
        deliveryId: "whd_test",
        event: "payment.completed",
        apiVersion: "2026-06",
        environment: "test",
      },
      verifyServiceAuthJwt: ({ token, expectedIss, expectedAud, expectedLxm }) => {
        assert.equal(token, "atm-service-auth-jwt");
        assert.equal(expectedIss, ATM_BROKER_DID);
        assert.equal(expectedAud, "did:plc:app#AtmEventReceiver");
        assert.equal(expectedLxm, ATM_EVENT_RECEIVE_NSID);
        return {
          iss: expectedIss,
          aud: expectedAud,
          lxm: expectedLxm,
          exp: webhookTimestamp + 60,
          iat: webhookTimestamp,
          jti: "jti_456",
        };
      },
    });
    assert.equal(receiverEvent.id, "whd_test");
    assert.equal(receiverEvent.data.payment.id, "pmt_test");
    const typedReceiverEvent = await constructTypedAtmXrpcReceiverEvent({
      rawBody: webhookBody,
      appDid: "did:plc:app",
      expectedType: "payment.completed",
      headers: {
        authorization: "Bearer atm-service-auth-jwt",
        deliveryId: "whd_test",
        apiVersion: "2026-06",
        environment: "test",
      },
      verifyServiceAuthJwt: ({ expectedIss, expectedAud, expectedLxm }) => ({
        iss: expectedIss,
        aud: expectedAud,
        lxm: expectedLxm,
        exp: webhookTimestamp + 60,
        iat: webhookTimestamp,
        jti: "jti_789",
      }),
    });
    assert.equal(typedReceiverEvent.data.payment.id, "pmt_test");

    await assert.rejects(
      () =>
        constructAtmXrpcReceiverEvent({
          rawBody: webhookBody,
          appDid: "did:plc:app",
          headers: {
            authorization: null,
          },
          verifyServiceAuthJwt: () => xrpcClaims,
        }),
      AtmXrpcReceiverAuthError
    );

    await assert.rejects(
      () =>
        constructAtmXrpcReceiverEvent({
          rawBody: webhookBody,
          appDid: "did:plc:app",
          headers: {
            authorization: "Bearer atm-service-auth-jwt",
            deliveryId: "whd_other",
          },
          verifyServiceAuthJwt: () => xrpcClaims,
        }),
      AtmXrpcReceiverAuthError
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function testInspectAtmAttestationRefs() {
  const broker = { proofUri: "at://did:plc:atm/network.attested.payment.proof/x" };
  const creator = { proofUri: "at://did:plc:creator/network.attested.payment.proof/x" };

  // Broker only → federated; satisfies a federated requirement, not strict.
  const fed = inspectAtmAttestationRefs({ broker });
  assert.equal(fed.presentTier, "federated");
  assert.equal(fed.cryptographicallyVerified, false);
  assert.ok(
    inspectAtmAttestationRefs({ broker }, { expect: "strict" }).missing.length > 0
  );

  // + creator proof → creator-trusted.
  const ct = inspectAtmAttestationRefs(
    { broker, creator },
    { expect: "creator-trusted" }
  );
  assert.equal(ct.presentTier, "creator-trusted");
  assert.deepEqual(ct.missing, []);

  // strict needs the payer record on the payer's OWN repo.
  const strict = inspectAtmAttestationRefs(
    {
      broker,
      creator,
      payer: {
        did: "did:plc:payer",
        recordUri: "at://did:plc:payer/network.attested.payment.oneTime/x",
      },
    },
    { expect: "strict" }
  );
  assert.equal(strict.presentTier, "strict");
  assert.deepEqual(strict.missing, []);

  // A payer record on the WRONG repo does not count toward strict.
  const wrongRepo = inspectAtmAttestationRefs(
    {
      broker,
      creator,
      payer: {
        did: "did:plc:payer",
        recordUri: "at://did:plc:atm/network.attested.payment.oneTime/x",
      },
    },
    { expect: "strict" }
  );
  assert.equal(wrongRepo.presentTier, "creator-trusted");
  assert.ok(wrongRepo.missing.includes("payer record on the payer's repo"));

  // No broker proof → nothing achieved.
  assert.equal(inspectAtmAttestationRefs({}).presentTier, null);
  assert.equal(inspectAtmAttestationRefs(null).cryptographicallyVerified, false);
}

testInspectAtmAttestationRefs();

void main();
