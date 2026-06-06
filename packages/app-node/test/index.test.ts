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
} from "../src/index";

const envelope = {
  recipient: "did:plc:creator",
  amount: 500,
  currency: "usd",
  paymentType: "shop" as const,
  environment: "test" as const,
  payerDid: "did:plc:buyer",
  metadata: {
    appOrderId: "ord_123",
    ignored: undefined,
  },
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
assert.equal(decoded.metadata.appOrderId, "ord_123");
assert.equal("ignored" in decoded.metadata, false);
assert.equal(decoded.listing.cid, "bafyabc");

assert.deepEqual(createPaymentInitiateBody(envelope), { product });
assert.throws(
  () => createAtmCheckoutProduct({ ...envelope, recipient: "alice.test" }),
  /recipient must be a DID/
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
  created: 1_779_000_000,
  apiVersion: "2026-05",
  environment: "test",
  data: {
    payment: {
      id: "pmt_test",
      amountCents: 500,
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
  payment: { id: string; amountCents: number; currency: string; status: string };
}>({
  rawBody: webhookBody,
  secret: webhookSecret,
  now: webhookTimestamp,
  headers: {
    signature,
    deliveryId: "whd_test",
    event: "payment.completed",
    apiVersion: "2026-05",
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
    apiVersion: "2026-05",
    environment: "test",
  },
});
assert.equal(typedWebhookEvent.data.payment.id, "pmt_test");

const nodeWebhookHandler = createNodeWebhookHandler({
  secret: webhookSecret,
  expectedType: "payment.completed",
  now: webhookTimestamp,
  insertDeliveryIdOnce: async (deliveryId) => deliveryId === "whd_test",
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
      "atm-api-version": "2026-05",
      "atm-environment": "test",
    },
  })
);
assert.equal(nodeWebhookResponse.status, 202);
assert.equal((await nodeWebhookResponse.json() as { accepted: boolean }).accepted, true);

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
  insertDeliveryIdOnce: () => false,
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
    items: [{ ticketTierId: "tier_demo", quantity: 2 }],
    metadata: { omitMe: undefined },
  }),
  {
    environment: "test",
    eventUri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
    buyerDid: "did:plc:buyer",
    items: [{ ticketTierId: "tier_demo", quantity: 2 }],
    metadata: {},
  }
);
assert.throws(
  () =>
    createTicketHoldBody({
      items: [{ ticketTierId: "tier_demo", quantity: 0 }],
    }),
  /positive integer/
);
assert.deepEqual(
  createFreeTicketClaimBody({
    environment: "test",
    ticketTierId: "tier_free",
    buyerDid: "did:plc:buyer",
    buyerAssertionJwt: "buyer.assertion.jwt",
  }),
  {
    environment: "test",
    ticketTierId: "tier_free",
    buyerDid: "did:plc:buyer",
    buyerAssertionJwt: "buyer.assertion.jwt",
  }
);
assert.throws(
  () =>
    createFreeTicketClaimBody({
      ticketTierId: "tier_free",
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
      items: [{ ticketTierId: "tier_demo", quantity: 1 }],
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
      ticketTierId: "tier_free",
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
    assert.equal(calls.length, 15);
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
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.createCapacityGroup"
    );
    assert.equal(
      calls[3].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.updateCapacityGroup"
    );
    assert.equal(
      calls[4].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.createTicketTier"
    );
    assert.equal(
      calls[5].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.updateTicketTier"
    );
    assert.equal(
      calls[6].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.archiveTicketTier"
    );
    assert.equal(
      calls[7].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.getTicketAvailability?environment=test&eventUri=at%3A%2F%2Fdid%3Aplc%3Aorganizer%2Fcommunity.lexicon.calendar.event%2Fdemo"
    );
    assert.equal(
      calls[8].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.createTicketHold"
    );
    assert.match(String(calls[8].init?.body), /"ticketTierId":"tier_demo"/);
    assert.equal(
      calls[9].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.releaseTicketHold"
    );
    assert.equal(
      calls[10].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.claimFreeTicket"
    );
    assert.match(String(calls[10].init?.body), /"ticketTierId":"tier_free"/);
    assert.equal(
      calls[11].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.listBuyerTickets?environment=test&buyerDid=did%3Aplc%3Abuyer&limit=10"
    );
    assert.equal(
      calls[12].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.listOrganizerTickets?environment=test&organizerDid=did%3Aplc%3Aorganizer&limit=25"
    );
    assert.equal(
      calls[13].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.verifyTicket"
    );
    assert.equal(
      calls[14].url,
      "https://checkout.atmosphere.money/xrpc/tickets.atmosphere.checkInTicket"
    );

    const receiverEvent = await constructAtmXrpcReceiverEvent<{
      payment: { id: string; amountCents: number; currency: string; status: string };
    }>({
      rawBody: webhookBody,
      appDid: "did:plc:app",
      headers: {
        authorization: "Bearer atm-service-auth-jwt",
        deliveryId: "whd_test",
        event: "payment.completed",
        apiVersion: "2026-05",
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
        apiVersion: "2026-05",
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

void main();
