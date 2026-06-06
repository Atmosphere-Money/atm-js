import { createServer } from "node:http";
import {
  ATM_BROKER_DID,
  ATM_EVENT_RECEIVE_NSID,
  constructAtmWebhookEvent,
  constructAtmXrpcReceiverEvent,
  createAtmAppClient,
  type AtmVerifiedServiceAuthClaims,
} from "@atmosphere-money/app-node";

const env = {
  atmBaseUrl: process.env.ATM_BASE_URL ?? "https://checkout.atmosphere.money",
  appServiceAuth: process.env.ATM_APP_SERVICE_AUTH ?? "",
  eventServiceAuth: process.env.ATM_EVENT_SERVICE_AUTH ?? "",
  webhookSecret: process.env.ATM_WEBHOOK_SECRET ?? "",
  appDid: process.env.APP_DID ?? "did:plc:exampleapp",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:8787",
  recipientDid: process.env.RECIPIENT_DID ?? "did:plc:creator",
};

const atm = createAtmAppClient({
  brokerUrl: env.atmBaseUrl,
  getServiceAuthToken: ({ lxm }) => {
    if (!env.appServiceAuth) {
      throw new Error(
        `ATM_APP_SERVICE_AUTH is required for ${lxm}; mint a fresh service-auth token per request in a real app.`
      );
    }
    return env.appServiceAuth;
  },
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function readBody(request: Request) {
  return await request.text();
}

async function createCheckout() {
  const payout = await atm.getPayoutStatus(env.recipientDid);
  if (payout.payable === false) {
    return {
      blocked: true,
      reason: payout.reason ?? "Recipient cannot receive payments yet.",
    };
  }

  return await atm.initiatePayment({
    recipient: env.recipientDid,
    amount: 500,
    currency: "usd",
    paymentType: "tip",
    environment: "test",
    returnUrl: `${env.appBaseUrl}/status`,
    cancelUrl: `${env.appBaseUrl}/`,
    metadata: {
      appOrderId: "ord_demo_123",
      example: "atm-node-app",
    },
  });
}

async function getTicketAvailability() {
  return await atm.getTicketAvailability({
    environment: "test",
    eventUri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
  });
}

async function createTicketTier() {
  return await atm.createTicketTier({
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
    maxPerOrder: 4,
  });
}

async function createTicketHold() {
  return await atm.createTicketHold({
    environment: "test",
    eventUri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
    buyerDid: "did:plc:buyer",
    buyerAssertionJwt: "<fresh-buyer-assertion>",
    items: [{ ticketTierId: "tier_demo", quantity: 1 }],
    returnUrl: `${env.appBaseUrl}/tickets/return`,
    cancelUrl: `${env.appBaseUrl}/events/demo`,
    idempotencyKey: "hold:demo:did:plc:buyer:tier_demo:1",
  });
}

async function releaseTicketHold() {
  return await atm.releaseTicketHold({
    environment: "test",
    holdId: "hold_demo",
    reason: "buyer_cancelled",
  });
}

async function claimFreeTicket() {
  return await atm.claimFreeTicket({
    environment: "test",
    eventUri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
    ticketTierId: "tier_free_demo",
    buyerDid: "did:plc:buyer",
    buyerAssertionJwt: "<fresh-buyer-assertion>",
    idempotencyKey: "claim:demo:did:plc:buyer:tier_free_demo",
  });
}

async function listBuyerTickets() {
  return await atm.listBuyerTickets({
    environment: "test",
    buyerDid: "did:plc:buyer",
    limit: 10,
  });
}

async function verifyTicket() {
  return await atm.verifyTicket({
    environment: "test",
    ticketToken: "opaque_scan_token_from_qr_or_wallet_pass",
  });
}

async function checkInTicket() {
  return await atm.checkInTicket({
    environment: "test",
    ticketToken: "opaque_scan_token_from_qr_or_wallet_pass",
    checkInListId: "list_demo",
    idempotencyKey: "checkin:list_demo:opaque_scan_token",
  });
}

function verifyLocalEventServiceAuth(input: {
  token: string;
  expectedIss: string;
  expectedAud: string;
  expectedLxm: string;
}): AtmVerifiedServiceAuthClaims {
  if (!env.eventServiceAuth || input.token !== env.eventServiceAuth) {
    throw new Error("Invalid local XRPC receiver token");
  }
  return {
    iss: input.expectedIss,
    aud: input.expectedAud,
    lxm: input.expectedLxm,
    exp: Math.floor(Date.now() / 1000) + 60,
    iat: Math.floor(Date.now() / 1000),
    jti: "local-demo-jti",
  };
}

async function handle(request: Request) {
  const url = new URL(request.url);
  try {
    if (request.method === "GET" && url.pathname === "/health") {
      return json(200, { ok: true, service: "atm-node-app-example" });
    }
    if (request.method === "POST" && url.pathname === "/checkout") {
      return json(200, await createCheckout());
    }
    if (request.method === "GET" && url.pathname === "/status") {
      const token = url.searchParams.get("token");
      if (!token) return json(400, { error: "MissingToken" });
      return json(200, await atm.getPaymentStatus(token));
    }
    if (request.method === "POST" && url.pathname === "/tickets/hold") {
      return json(200, await createTicketHold());
    }
    if (request.method === "GET" && url.pathname === "/tickets/availability") {
      return json(200, await getTicketAvailability());
    }
    if (request.method === "POST" && url.pathname === "/tickets/tier") {
      return json(200, await createTicketTier());
    }
    if (request.method === "POST" && url.pathname === "/tickets/free-claim") {
      return json(200, await claimFreeTicket());
    }
    if (request.method === "POST" && url.pathname === "/tickets/release-hold") {
      return json(200, await releaseTicketHold());
    }
    if (request.method === "GET" && url.pathname === "/tickets/buyer") {
      return json(200, await listBuyerTickets());
    }
    if (request.method === "POST" && url.pathname === "/tickets/verify") {
      return json(200, await verifyTicket());
    }
    if (request.method === "POST" && url.pathname === "/tickets/check-in") {
      return json(200, await checkInTicket());
    }
    if (request.method === "POST" && url.pathname === "/webhooks/atm") {
      const rawBody = await readBody(request);
      const event = constructAtmWebhookEvent({
        rawBody,
        secret: env.webhookSecret,
        headers: {
          signature: request.headers.get("atm-signature"),
          deliveryId: request.headers.get("atm-delivery-id"),
          event: request.headers.get("atm-event"),
          apiVersion: request.headers.get("atm-api-version"),
          environment: request.headers.get("atm-environment"),
        },
      });
      console.log("verified ATM event", event.type, event.id);
      return json(200, { ok: true, deliveryId: event.id });
    }
    if (
      request.method === "POST" &&
      url.pathname === "/xrpc/money.atmosphere.event.receive"
    ) {
      const rawBody = await readBody(request);
      const event = await constructAtmXrpcReceiverEvent({
        rawBody,
        appDid: env.appDid,
        expectedIssuerDid: ATM_BROKER_DID,
        expectedLxm: ATM_EVENT_RECEIVE_NSID,
        headers: {
          authorization: request.headers.get("authorization"),
          deliveryId: request.headers.get("atm-delivery-id"),
          event: request.headers.get("atm-event"),
          apiVersion: request.headers.get("atm-api-version"),
          environment: request.headers.get("atm-environment"),
        },
        verifyServiceAuthJwt: verifyLocalEventServiceAuth,
      });
      console.log("received ATM XRPC event", event.type, event.id);
      return json(200, { ok: true, deliveryId: event.id });
    }
    return json(404, { error: "NotFound" });
  } catch (error) {
    return json(500, {
      error: "ExampleError",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

createServer(async (request, response) => {
  const body = await handle(
    new Request(`http://localhost:8787${request.url}`, {
      method: request.method,
      headers: request.headers as HeadersInit,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request,
      duplex: "half",
    } as RequestInit)
  );
  const headers: Record<string, string> = {};
  body.headers.forEach((value, key) => {
    headers[key] = value;
  });
  response.writeHead(body.status, headers);
  response.end(await body.text());
}).listen(8787, () => {
  console.log("ATM example server listening on http://localhost:8787");
});
