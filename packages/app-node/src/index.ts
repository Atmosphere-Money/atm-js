import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-side helpers for apps integrating with Atmosphere Money.
 *
 * Keep this package on your backend. Do not build `atm.checkout.v1:`
 * envelopes in browser code because they may contain private checkout/session
 * context, app order ids, buyer assertions, or return/cancel URLs.
 */

export const ATM_CHECKOUT_PRODUCT_PREFIX = "atm.checkout.v1:";
export const DEFAULT_ATM_BROKER_URL = "https://checkout.atmosphere.money";
export const DEFAULT_ATM_APPVIEW_URL = "https://appview.atmosphere.money";
export const ATM_BROKER_DID = "did:plc:a54sdlhmv7xklga67xamqfyq";
export const ATM_BROKER_SERVICE_AUDIENCE =
  `${ATM_BROKER_DID}#AttestedNetwork`;
export const DEFAULT_ATM_WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
export const ATM_EVENT_RECEIVE_NSID = "money.atmosphere.event.receive";
export const DEFAULT_ATM_XRPC_RECEIVER_SERVICE = "#AtmEventReceiver";
export const ATM_XRPC_METHODS = {
  actor: {
    getPayoutStatus: "money.atmosphere.actor.getPayoutStatus",
    getProfile: "money.atmosphere.actor.getProfile",
  },
  payment: {
    initiate: "network.attested.payment.initiate",
    status: "network.attested.payment.status",
  },
  event: {
    receive: "money.atmosphere.event.receive",
  },
  tickets: {
    archiveTicketTier: "tickets.atmosphere.archiveTicketTier",
    checkInTicket: "tickets.atmosphere.checkInTicket",
    claimFreeTicket: "tickets.atmosphere.claimFreeTicket",
    createCapacityGroup: "tickets.atmosphere.createCapacityGroup",
    createTicketHold: "tickets.atmosphere.createTicketHold",
    createTicketTier: "tickets.atmosphere.createTicketTier",
    getTicketAvailability: "tickets.atmosphere.getTicketAvailability",
    listBuyerTickets: "tickets.atmosphere.listBuyerTickets",
    listOrganizerTickets: "tickets.atmosphere.listOrganizerTickets",
    releaseTicketHold: "tickets.atmosphere.releaseTicketHold",
    updateCapacityGroup: "tickets.atmosphere.updateCapacityGroup",
    updateTicketTier: "tickets.atmosphere.updateTicketTier",
    verifyTicket: "tickets.atmosphere.verifyTicket",
  },
} as const;

type NestedStringValue<T> = T extends string
  ? T
  : T extends Record<string, unknown>
    ? NestedStringValue<T[keyof T]>
    : never;

export type AtmXrpcMethod = NestedStringValue<typeof ATM_XRPC_METHODS>;

export type AtmEnvironment = "test" | "live";
export type AtmPaymentType = "tip" | "shop" | "commission" | "subscribe" | "ticket";

export type AtmStrongRef = {
  $type: "com.atproto.repo.strongRef";
  uri: string;
  cid: string;
};

export type AtmCheckoutEnvelope = {
  recipient: string;
  amount: number | string;
  currency?: string;
  paymentType?: AtmPaymentType;
  environment?: AtmEnvironment;
  payerDid?: string;
  payerAssertionJwt?: string;
  customerEmail?: string;
  creatorHandle?: string;
  creatorDisplayName?: string;
  returnUrl?: string;
  cancelUrl?: string;
  interval?: "month" | "quarter" | "year";
  listing?: AtmStrongRef;
  entitlements?: AtmStrongRef[];
  discount?: AtmStrongRef;
  discountCode?: AtmStrongRef;
  metadata?: Record<string, unknown>;
};

export type AtmTicketHoldInput = {
  environment?: AtmEnvironment;
  eventId?: string;
  eventUri?: string;
  buyerDid?: string;
  buyerAssertionJwt?: string;
  customerEmail?: string;
  items: Array<{ ticketTierId: string; quantity: number }>;
  returnUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type AtmTicketAvailabilityParams = {
  environment?: AtmEnvironment;
  eventId?: string;
  eventUri?: string;
};

export type AtmFreeTicketClaimInput = {
  environment?: AtmEnvironment;
  eventId?: string;
  eventUri?: string;
  ticketTierId: string;
  buyerDid: string;
  buyerAssertionJwt: string;
  customerEmail?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type AtmTicketCheckInInput = {
  environment?: AtmEnvironment;
  ticketToken: string;
  checkInListId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type AtmTicketEventInput = {
  uri?: string;
  cid?: string;
  title?: string;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
  url?: string;
  image?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AtmCreateTicketTierInput = {
  environment?: AtmEnvironment;
  organizerDid: string;
  organizerAssertionJwt?: string;
  event: AtmTicketEventInput;
  title: string;
  description?: string | null;
  currency: string;
  unitAmount: number;
  quantityTotal: number;
  maxPerOrder?: number;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  tierRef?: AtmStrongRef | null;
  productRef?: AtmStrongRef | null;
  priceRef?: AtmStrongRef | null;
  metadata?: Record<string, unknown>;
};

export type AtmUpdateTicketTierInput = {
  environment?: AtmEnvironment;
  tierId: string;
  title?: string;
  description?: string | null;
  currency?: string;
  unitAmount?: number;
  maxPerOrder?: number;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  tierRef?: AtmStrongRef | null;
  productRef?: AtmStrongRef | null;
  priceRef?: AtmStrongRef | null;
  metadata?: Record<string, unknown>;
  status?: "active" | "paused" | "archived";
};

export type AtmArchiveTicketTierInput = {
  environment?: AtmEnvironment;
  tierId: string;
};

export type AtmCreateCapacityGroupInput = {
  environment?: AtmEnvironment;
  organizerDid: string;
  event: AtmTicketEventInput;
  name: string;
  totalCapacity: number;
  metadata?: Record<string, unknown>;
};

export type AtmUpdateCapacityGroupInput = {
  environment?: AtmEnvironment;
  capacityGroupId: string;
  name?: string;
  totalCapacity?: number;
  status?: "active" | "archived";
  metadata?: Record<string, unknown>;
};

export type AtmReleaseTicketHoldInput = {
  environment?: AtmEnvironment;
  holdId: string;
  reason?: string;
};

export type AtmListBuyerTicketsParams = {
  environment?: AtmEnvironment;
  buyerDid?: string;
  paymentId?: string;
  limit?: number;
  cursor?: string;
};

export type AtmListOrganizerTicketsParams = {
  environment?: AtmEnvironment;
  organizerDid?: string;
  eventId?: string;
  limit?: number;
  cursor?: string;
};

export type AtmVerifyTicketInput = {
  environment?: AtmEnvironment;
  ticketToken: string;
};

export type AtmServiceAuthTokenProvider = (input: {
  lxm: string;
  aud: string;
}) => Promise<string> | string;

export type AtmAppClientOptions = {
  brokerUrl?: string;
  appViewUrl?: string;
  serviceAudience?: string;
  getServiceAuthToken: AtmServiceAuthTokenProvider;
};

export type AtmInitiatePaymentResult = {
  token: string;
  url: string;
};

export type AtmWebhookEnvelope<TData = Record<string, unknown>> = {
  id: string;
  type: string;
  created: number;
  apiVersion: string;
  environment: AtmEnvironment;
  data: TData;
};

export type AtmWebhookEventType =
  | "app.webhook.test"
  | "payment.completed"
  | "payment.failed"
  | "payment.refunded"
  | "payment.disputed"
  | "subscription.invoice_paid"
  | "subscription.updated"
  | "subscription.cancelled"
  | "payer.record.requested"
  | "creator.proof.requested"
  | "attestation.updated"
  | "product.updated"
  | "product.archived"
  | "product.deleted"
  | "ticket.hold.created"
  | "ticket.hold.expired"
  | "tickets.issued"
  | "ticket.voided"
  | "ticket.refunded"
  | "ticket.checked_in";

export type AtmPaymentSummary = {
  id: string;
  amountCents?: number;
  currency?: string;
  status?: string;
  paymentType?: AtmPaymentType | string;
  payerDid?: string | null;
  recipientDid?: string | null;
  appDid?: string | null;
  createdAt?: string;
  [key: string]: unknown;
};

export type AtmSubscriptionSummary = {
  id: string;
  status?: string;
  amountCents?: number;
  currency?: string;
  interval?: "month" | "quarter" | "year" | string;
  payerDid?: string | null;
  recipientDid?: string | null;
  appDid?: string | null;
  [key: string]: unknown;
};

export type AtmTicketSummary = {
  id?: string;
  ticketId?: string;
  ticketTierId?: string;
  eventId?: string;
  eventUri?: string;
  status?: string;
  [key: string]: unknown;
};

export type AtmCapacityGroupSummary = {
  id?: string;
  name?: string;
  status?: string;
  totalCapacity?: number;
  [key: string]: unknown;
};

export type AtmTicketTierSummary = {
  id?: string;
  title?: string;
  status?: string;
  currency?: string;
  unitAmount?: number;
  quantityTotal?: number;
  [key: string]: unknown;
};

export type AtmTicketEventSummary = {
  id?: string;
  uri?: string;
  title?: string;
  [key: string]: unknown;
};

export type AtmPaymentEventData = {
  payment: AtmPaymentSummary;
  [key: string]: unknown;
};

export type AtmSubscriptionEventData = {
  subscription: AtmSubscriptionSummary;
  payment?: AtmPaymentSummary;
  [key: string]: unknown;
};

export type AtmTicketEventData = {
  eventId?: string;
  eventUri?: string;
  holdId?: string;
  paymentId?: string;
  issuedCount?: number;
  tickets?: AtmTicketSummary[];
  [key: string]: unknown;
};

export type AtmProductEventData = {
  productUri?: string;
  productCid?: string;
  appDid?: string;
  creatorDid?: string;
  [key: string]: unknown;
};

export type AtmEventDataByType = {
  "payment.completed": AtmPaymentEventData;
  "payment.failed": AtmPaymentEventData;
  "payment.refunded": AtmPaymentEventData;
  "payment.disputed": AtmPaymentEventData;
  "subscription.invoice_paid": AtmSubscriptionEventData;
  "subscription.updated": AtmSubscriptionEventData;
  "subscription.cancelled": AtmSubscriptionEventData;
  "product.updated": AtmProductEventData;
  "product.archived": AtmProductEventData;
  "product.deleted": AtmProductEventData;
  "ticket.hold.created": AtmTicketEventData;
  "ticket.hold.expired": AtmTicketEventData;
  "tickets.issued": AtmTicketEventData;
  "ticket.voided": AtmTicketEventData;
  "ticket.refunded": AtmTicketEventData;
  "ticket.checked_in": AtmTicketEventData;
};

export type AtmEventDataFor<TType extends AtmWebhookEventType> =
  TType extends keyof AtmEventDataByType
    ? AtmEventDataByType[TType]
    : Record<string, unknown>;

export type AtmTypedEvent<TType extends AtmWebhookEventType> =
  AtmWebhookEnvelope<AtmEventDataFor<TType>> & { type: TType };

export type AtmTypedWebhookEnvelope<TType extends keyof AtmEventDataByType> =
  AtmWebhookEnvelope<AtmEventDataByType[TType]> & { type: TType };

export type AtmPaymentCompletedEvent = AtmTypedEvent<"payment.completed">;
export type AtmTicketsIssuedEvent = AtmTypedEvent<"tickets.issued">;
export type AtmTicketCheckedInEvent = AtmTypedEvent<"ticket.checked_in">;

export type AtmPayoutStatus = {
  actor?: string;
  payable?: boolean;
  status?: string;
  reason?: string;
  [key: string]: unknown;
};

export type AtmPaymentStatus = {
  token?: string;
  status?: string;
  payment?: AtmPaymentSummary;
  [key: string]: unknown;
};

export type AtmProfile = {
  did?: string;
  handle?: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  [key: string]: unknown;
};

export type AtmTicketAvailability = {
  eventId?: string;
  eventUri?: string;
  environment?: AtmEnvironment;
  available?: boolean;
  tiers?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type AtmTicketHoldResult = {
  holdId?: string;
  token?: string;
  url?: string;
  expiresAt?: string;
  [key: string]: unknown;
};

export type AtmTicketTierResult = {
  event?: AtmTicketEventSummary;
  capacityGroup?: AtmCapacityGroupSummary;
  tier?: AtmTicketTierSummary;
  [key: string]: unknown;
};

export type AtmCapacityGroupResult = {
  event?: AtmTicketEventSummary;
  capacityGroup?: AtmCapacityGroupSummary;
  [key: string]: unknown;
};

export type AtmArchiveTicketTierResult = {
  tier?: AtmTicketTierSummary;
  [key: string]: unknown;
};

export type AtmReleaseTicketHoldResult = {
  hold?: {
    id?: string;
    status?: "released" | "expired" | "failed" | "completed" | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type AtmListTicketsResult = {
  tickets: AtmTicketSummary[];
  cursor?: string;
  [key: string]: unknown;
};

export type AtmFreeTicketClaimResult = {
  claimId?: string;
  tickets?: AtmTicketSummary[];
  [key: string]: unknown;
};

export type AtmTicketCheckInResult = {
  ok?: boolean;
  status?: string;
  ticket?: AtmTicketSummary;
  [key: string]: unknown;
};

export type AtmVerifyTicketResult = {
  valid: boolean;
  reason?: string;
  ticket?: AtmTicketSummary;
  presentation?: Record<string, unknown>;
  event?: AtmTicketEventSummary;
  tier?: AtmTicketTierSummary;
  [key: string]: unknown;
};

export type AtmWebhookHeaders = {
  signature: string | null | undefined;
  deliveryId: string | null | undefined;
  event?: string | null | undefined;
  apiVersion?: string | null | undefined;
  environment?: string | null | undefined;
};

export type VerifyAtmWebhookOptions = {
  rawBody: string;
  signature: string;
  deliveryId: string;
  secret: string | readonly string[];
  toleranceSeconds?: number;
  now?: number;
};

export type ConstructAtmWebhookOptions = {
  rawBody: string;
  headers: AtmWebhookHeaders;
  secret: string | readonly string[];
  toleranceSeconds?: number;
  now?: number;
};

export type AtmVerifiedServiceAuthClaims = {
  iss: string;
  aud: string;
  lxm: string;
  exp?: number;
  iat?: number;
  jti?: string;
};

export type AtmReceiverServiceAuthVerifier = (input: {
  token: string;
  expectedIss: string;
  expectedAud: string;
  expectedLxm: string;
}) => Promise<AtmVerifiedServiceAuthClaims> | AtmVerifiedServiceAuthClaims;

export type AtmXrpcReceiverHeaders = {
  authorization: string | null | undefined;
  deliveryId?: string | null | undefined;
  event?: string | null | undefined;
  apiVersion?: string | null | undefined;
  environment?: string | null | undefined;
};

export type ConstructAtmXrpcReceiverOptions = {
  rawBody: string;
  headers: AtmXrpcReceiverHeaders;
  appDid: string;
  serviceRef?: string;
  expectedIssuerDid?: string;
  expectedLxm?: string;
  verifyServiceAuthJwt: AtmReceiverServiceAuthVerifier;
};

export type VerifyServiceAuthRequestOptions = {
  request: Request;
  expectedIss: string;
  expectedAud: string;
  expectedLxm: string;
  verifyServiceAuthJwt: AtmReceiverServiceAuthVerifier;
};

export type AtmWebhookHandlerEvent<
  TType extends AtmWebhookEventType | undefined = undefined,
> = TType extends AtmWebhookEventType
  ? AtmTypedEvent<TType>
  : AtmWebhookEnvelope;

export type AtmWebhookHandlerResult =
  | Response
  | {
      status?: number;
      body?: unknown;
      headers?: Record<string, string>;
    }
  | void;

export type AtmWebhookHandlerOptions<
  TType extends AtmWebhookEventType | undefined = undefined,
> = {
  secret: string | readonly string[];
  expectedType?: TType;
  toleranceSeconds?: number;
  now?: number;
  insertDeliveryIdOnce?: (
    deliveryId: string,
    event: AtmWebhookHandlerEvent<TType>
  ) => Promise<boolean> | boolean;
  onEvent: (
    event: AtmWebhookHandlerEvent<TType>,
    context: { rawBody: string; request?: Request }
  ) => Promise<AtmWebhookHandlerResult> | AtmWebhookHandlerResult;
  onError?: (error: unknown) => Promise<AtmWebhookHandlerResult> | AtmWebhookHandlerResult;
};

export type AtmExpressLikeRequest = {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: string | Buffer;
  body?: unknown;
};

export type AtmExpressLikeResponse = {
  status(code: number): AtmExpressLikeResponse;
  json(body: unknown): unknown;
  send?(body: unknown): unknown;
  setHeader?(name: string, value: string): unknown;
};

export type AtmExpressWebhookHandlerOptions<
  TType extends AtmWebhookEventType | undefined = undefined,
> = AtmWebhookHandlerOptions<TType> & {
  getRawBody?: (request: AtmExpressLikeRequest) => Promise<string | Buffer> | string | Buffer;
};

export type AtmHonoLikeContext = {
  req: {
    raw: Request;
  };
};

export type AtmCloudflareWorkerWebhookHandler = {
  fetch(request: Request): Promise<Response>;
};

export function createAtmCheckoutProduct(input: AtmCheckoutEnvelope): string {
  assertDid(input.recipient, "recipient");
  if (input.amount === "" || input.amount === null || input.amount === undefined) {
    throw new Error("amount is required");
  }
  const payload = pruneUndefined(input);
  return `${ATM_CHECKOUT_PRODUCT_PREFIX}${base64UrlEncode(JSON.stringify(payload))}`;
}

export function createPaymentInitiateBody(input: AtmCheckoutEnvelope): {
  product: string;
} {
  return { product: createAtmCheckoutProduct(input) };
}

export function createTicketHoldBody(input: AtmTicketHoldInput): AtmTicketHoldInput {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("ticket hold requires at least one item");
  }
  for (const item of input.items) {
    if (!item.ticketTierId) {
      throw new Error("ticket hold items require ticketTierId");
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error("ticket hold item quantity must be a positive integer");
    }
  }
  if (input.buyerDid) assertDid(input.buyerDid, "buyerDid");
  return pruneUndefined(input);
}

export function createFreeTicketClaimBody(
  input: AtmFreeTicketClaimInput
): AtmFreeTicketClaimInput {
  assertDid(input.buyerDid, "buyerDid");
  if (!input.buyerAssertionJwt) {
    throw new Error("free ticket claims require buyerAssertionJwt");
  }
  if (!input.ticketTierId) {
    throw new Error("free ticket claims require ticketTierId");
  }
  return pruneUndefined(input);
}

export function signAtmWebhookPayload(opts: {
  rawBody: string;
  deliveryId: string;
  secret: string;
  timestamp?: number;
}): string {
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${opts.deliveryId}.${opts.rawBody}`;
  const digest = createHmac("sha256", opts.secret)
    .update(signedPayload)
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

export function verifyAtmWebhookSignature(
  opts: VerifyAtmWebhookOptions
): boolean {
  const parsed = parseAtmSignatureHeader(opts.signature);
  if (!parsed) return false;
  const tolerance =
    opts.toleranceSeconds ?? DEFAULT_ATM_WEBHOOK_TOLERANCE_SECONDS;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > tolerance) return false;

  const signedPayload = `${parsed.timestamp}.${opts.deliveryId}.${opts.rawBody}`;
  const secrets = normalizeSecrets(opts.secret);
  if (secrets.length === 0) return false;

  return secrets.some((secret) => {
    const expected = createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");
    const expectedBuffer = Uint8Array.from(Buffer.from(expected, "hex"));
    return parsed.signatures.some((candidate) => {
      if (!/^[0-9a-fA-F]{64}$/.test(candidate)) return false;
      const candidateBuffer = Uint8Array.from(Buffer.from(candidate, "hex"));
      return timingSafeEqual(expectedBuffer, candidateBuffer);
    });
  });
}

export function constructAtmWebhookEvent<TData = Record<string, unknown>>(
  opts: ConstructAtmWebhookOptions
): AtmWebhookEnvelope<TData> {
  const signature = opts.headers.signature;
  const deliveryId = opts.headers.deliveryId;
  if (!signature) {
    throw new AtmWebhookSignatureError("Missing Atm-Signature header");
  }
  if (!deliveryId) {
    throw new AtmWebhookSignatureError("Missing Atm-Delivery-Id header");
  }
  const ok = verifyAtmWebhookSignature({
    rawBody: opts.rawBody,
    signature,
    deliveryId,
    secret: opts.secret,
    toleranceSeconds: opts.toleranceSeconds,
    now: opts.now,
  });
  if (!ok) {
    throw new AtmWebhookSignatureError("ATM webhook signature is invalid");
  }
  const parsed = safeJsonParse(opts.rawBody);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AtmWebhookSignatureError("ATM webhook body is not a JSON object");
  }
  const event = parsed as Partial<AtmWebhookEnvelope<TData>>;
  if (event.id !== deliveryId) {
    throw new AtmWebhookSignatureError(
      "ATM webhook delivery id does not match the signed body"
    );
  }
  if (opts.headers.event && event.type !== opts.headers.event) {
    throw new AtmWebhookSignatureError(
      "ATM webhook event type does not match the signed body"
    );
  }
  if (opts.headers.apiVersion && event.apiVersion !== opts.headers.apiVersion) {
    throw new AtmWebhookSignatureError(
      "ATM webhook API version does not match the signed body"
    );
  }
  if (opts.headers.environment && event.environment !== opts.headers.environment) {
    throw new AtmWebhookSignatureError(
      "ATM webhook environment does not match the signed body"
    );
  }
  return event as AtmWebhookEnvelope<TData>;
}

export function constructTypedAtmWebhookEvent<TType extends AtmWebhookEventType>(
  opts: ConstructAtmWebhookOptions & { expectedType: TType }
): AtmTypedEvent<TType> {
  const event = constructAtmWebhookEvent<AtmEventDataFor<TType>>({
    ...opts,
    headers: {
      ...opts.headers,
      event: opts.headers.event ?? opts.expectedType,
    },
  });
  if (event.type !== opts.expectedType) {
    throw new AtmWebhookSignatureError(
      `ATM webhook event type does not match expected ${opts.expectedType}`
    );
  }
  return event as AtmTypedEvent<TType>;
}

export function createNodeWebhookHandler<
  TType extends AtmWebhookEventType | undefined = undefined,
>(options: AtmWebhookHandlerOptions<TType>) {
  return async function handleAtmWebhook(request: Request): Promise<Response> {
    try {
      const rawBody = await request.text();
      const event = constructWebhookHandlerEvent(rawBody, requestHeaders(request), options);
      if (options.insertDeliveryIdOnce) {
        const inserted = await options.insertDeliveryIdOnce(event.id, event);
        if (!inserted) {
          return jsonResponse(200, { ok: true, duplicate: true, deliveryId: event.id });
        }
      }
      return normalizeWebhookHandlerResult(
        await options.onEvent(event, { rawBody, request })
      );
    } catch (error) {
      if (options.onError) {
        return normalizeWebhookHandlerResult(await options.onError(error));
      }
      return defaultWebhookErrorResponse(error);
    }
  };
}

export const createNextWebhookRoute = createNodeWebhookHandler;

export function createHonoWebhookHandler<
  TType extends AtmWebhookEventType | undefined = undefined,
>(options: AtmWebhookHandlerOptions<TType>) {
  const handler = createNodeWebhookHandler(options);
  return function handleAtmHonoWebhook(
    contextOrRequest: AtmHonoLikeContext | Request
  ): Promise<Response> {
    const request =
      contextOrRequest instanceof Request
        ? contextOrRequest
        : contextOrRequest.req.raw;
    return handler(request);
  };
}

export function createCloudflareWorkerWebhookHandler<
  TType extends AtmWebhookEventType | undefined = undefined,
>(
  options: AtmWebhookHandlerOptions<TType>
): AtmCloudflareWorkerWebhookHandler {
  const handler = createNodeWebhookHandler(options);
  return {
    fetch(request: Request) {
      return handler(request);
    },
  };
}

export function createExpressWebhookHandler<
  TType extends AtmWebhookEventType | undefined = undefined,
>(options: AtmExpressWebhookHandlerOptions<TType>) {
  return async function handleAtmExpressWebhook(
    request: AtmExpressLikeRequest,
    response: AtmExpressLikeResponse,
    next?: (error?: unknown) => void
  ): Promise<void> {
    try {
      const raw = options.getRawBody
        ? await options.getRawBody(request)
        : defaultExpressRawBody(request);
      const rawBody = Buffer.isBuffer(raw) ? raw.toString("utf8") : raw;
      const event = constructWebhookHandlerEvent(
        rawBody,
        expressHeaders(request.headers),
        options
      );
      if (options.insertDeliveryIdOnce) {
        const inserted = await options.insertDeliveryIdOnce(event.id, event);
        if (!inserted) {
          sendExpressJson(response, 200, {
            ok: true,
            duplicate: true,
            deliveryId: event.id,
          });
          return;
        }
      }
      const result = await options.onEvent(event, { rawBody });
      const normalized = normalizePlainWebhookHandlerResult(result);
      sendExpressJson(response, normalized.status, normalized.body, normalized.headers);
    } catch (error) {
      if (options.onError) {
        const normalized = normalizePlainWebhookHandlerResult(
          await options.onError(error)
        );
        sendExpressJson(response, normalized.status, normalized.body, normalized.headers);
        return;
      }
      if (next) {
        next(error);
        return;
      }
      const normalized = defaultPlainWebhookError(error);
      sendExpressJson(response, normalized.status, normalized.body, normalized.headers);
    }
  };
}

export async function constructAtmXrpcReceiverEvent<
  TData = Record<string, unknown>,
>(
  opts: ConstructAtmXrpcReceiverOptions
): Promise<AtmWebhookEnvelope<TData>> {
  assertDid(opts.appDid, "appDid");
  const expectedAud = receiverAudience(
    opts.appDid,
    opts.serviceRef ?? DEFAULT_ATM_XRPC_RECEIVER_SERVICE
  );
  const expectedIssuerDid = opts.expectedIssuerDid ?? ATM_BROKER_DID;
  const expectedLxm = opts.expectedLxm ?? ATM_EVENT_RECEIVE_NSID;
  const token = bearerToken(opts.headers.authorization);
  if (!token) {
    throw new AtmXrpcReceiverAuthError("Missing XRPC receiver Authorization bearer token");
  }
  const claims = await opts.verifyServiceAuthJwt({
    token,
    expectedIss: expectedIssuerDid,
    expectedAud,
    expectedLxm,
  });
  verifyAtmReceiverServiceAuthClaims({
    claims,
    expectedIss: expectedIssuerDid,
    expectedAud,
    expectedLxm,
  });

  const event = parseAtmEventEnvelope<TData>(opts.rawBody);
  assertOptionalEventHeaders(event, {
    deliveryId: opts.headers.deliveryId,
    event: opts.headers.event,
    apiVersion: opts.headers.apiVersion,
    environment: opts.headers.environment,
  });
  return event;
}

export async function verifyServiceAuthRequest(
  opts: VerifyServiceAuthRequestOptions
): Promise<AtmVerifiedServiceAuthClaims> {
  const token = bearerToken(opts.request.headers.get("authorization"));
  if (!token) {
    throw new AtmXrpcReceiverAuthError("Missing service-auth Authorization bearer token");
  }
  const claims = await opts.verifyServiceAuthJwt({
    token,
    expectedIss: opts.expectedIss,
    expectedAud: opts.expectedAud,
    expectedLxm: opts.expectedLxm,
  });
  verifyAtmReceiverServiceAuthClaims({
    claims,
    expectedIss: opts.expectedIss,
    expectedAud: opts.expectedAud,
    expectedLxm: opts.expectedLxm,
  });
  return claims;
}

export async function constructTypedAtmXrpcReceiverEvent<
  TType extends AtmWebhookEventType,
>(
  opts: ConstructAtmXrpcReceiverOptions & { expectedType: TType }
): Promise<AtmTypedEvent<TType>> {
  const event = await constructAtmXrpcReceiverEvent<AtmEventDataFor<TType>>({
    ...opts,
    headers: {
      ...opts.headers,
      event: opts.headers.event ?? opts.expectedType,
    },
  });
  if (event.type !== opts.expectedType) {
    throw new AtmXrpcReceiverAuthError(
      `ATM XRPC receiver event type does not match expected ${opts.expectedType}`
    );
  }
  return event as AtmTypedEvent<TType>;
}

export function verifyAtmReceiverServiceAuthClaims(opts: {
  claims: AtmVerifiedServiceAuthClaims;
  expectedIss: string;
  expectedAud: string;
  expectedLxm: string;
}): void {
  if (opts.claims.iss !== opts.expectedIss) {
    throw new AtmXrpcReceiverAuthError(
      `ATM receiver JWT iss mismatch: expected ${opts.expectedIss}`
    );
  }
  if (opts.claims.aud !== opts.expectedAud) {
    throw new AtmXrpcReceiverAuthError(
      `ATM receiver JWT aud mismatch: expected ${opts.expectedAud}`
    );
  }
  if (opts.claims.lxm !== opts.expectedLxm) {
    throw new AtmXrpcReceiverAuthError(
      `ATM receiver JWT lxm mismatch: expected ${opts.expectedLxm}`
    );
  }
}

export function createAtmXrpcReceiverAudience(
  appDid: string,
  serviceRef = DEFAULT_ATM_XRPC_RECEIVER_SERVICE
): string {
  assertDid(appDid, "appDid");
  return receiverAudience(appDid, serviceRef);
}

export function createAtmAppClient(options: AtmAppClientOptions) {
  const brokerUrl = normalizeBaseUrl(options.brokerUrl ?? DEFAULT_ATM_BROKER_URL);
  const appViewUrl = normalizeBaseUrl(options.appViewUrl ?? DEFAULT_ATM_APPVIEW_URL);
  const audience = options.serviceAudience ?? ATM_BROKER_SERVICE_AUDIENCE;

  async function callJson<T>(
    baseUrl: string,
    method: string,
    nsid: string,
    body?: unknown
  ): Promise<T> {
    const token = await options.getServiceAuthToken({ lxm: nsid, aud: audience });
    const res = await fetch(`${baseUrl}/xrpc/${nsid}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return readAtmJson<T>(res);
  }

  async function callQuery<T>(
    baseUrl: string,
    nsid: string,
    params: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const token = await options.getServiceAuthToken({ lxm: nsid, aud: audience });
    const url = new URL(`${baseUrl}/xrpc/${nsid}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
    });
    return readAtmJson<T>(res);
  }

  return {
    createCheckoutProduct: createAtmCheckoutProduct,
    createPaymentInitiateBody,

    getPayoutStatus(actor: string) {
      return callQuery<AtmPayoutStatus>(
        brokerUrl,
        ATM_XRPC_METHODS.actor.getPayoutStatus,
        { actor }
      );
    },

    initiatePayment(input: AtmCheckoutEnvelope) {
      return callJson<AtmInitiatePaymentResult>(
        brokerUrl,
        "POST",
        ATM_XRPC_METHODS.payment.initiate,
        createPaymentInitiateBody(input)
      );
    },

    getPaymentStatus(token: string) {
      return callQuery<AtmPaymentStatus>(
        brokerUrl,
        ATM_XRPC_METHODS.payment.status,
        { token }
      );
    },

    createTicketTier(input: AtmCreateTicketTierInput) {
      return callJson<AtmTicketTierResult>(
        brokerUrl,
        "POST",
        ATM_XRPC_METHODS.tickets.createTicketTier,
        input
      );
    },

    updateTicketTier(input: AtmUpdateTicketTierInput) {
      return callJson<{ tier?: AtmTicketTierSummary; [key: string]: unknown }>(
        brokerUrl,
        "POST",
        ATM_XRPC_METHODS.tickets.updateTicketTier,
        input
      );
    },

    archiveTicketTier(input: AtmArchiveTicketTierInput) {
      return callJson<AtmArchiveTicketTierResult>(
        brokerUrl,
        "POST",
        ATM_XRPC_METHODS.tickets.archiveTicketTier,
        input
      );
    },

    createCapacityGroup(input: AtmCreateCapacityGroupInput) {
      return callJson<AtmCapacityGroupResult>(
        brokerUrl,
        "POST",
        ATM_XRPC_METHODS.tickets.createCapacityGroup,
        input
      );
    },

    updateCapacityGroup(input: AtmUpdateCapacityGroupInput) {
      return callJson<{ capacityGroup?: AtmCapacityGroupSummary; [key: string]: unknown }>(
        brokerUrl,
        "POST",
        ATM_XRPC_METHODS.tickets.updateCapacityGroup,
        input
      );
    },

    getTicketAvailability(input: AtmTicketAvailabilityParams) {
      return callQuery<AtmTicketAvailability>(
        brokerUrl,
        ATM_XRPC_METHODS.tickets.getTicketAvailability,
        {
          environment: input.environment,
          eventId: input.eventId,
          eventUri: input.eventUri,
        }
      );
    },

    createTicketHold(input: AtmTicketHoldInput) {
      return callJson<AtmTicketHoldResult>(
        brokerUrl,
        "POST",
        ATM_XRPC_METHODS.tickets.createTicketHold,
        createTicketHoldBody(input)
      );
    },

    releaseTicketHold(input: AtmReleaseTicketHoldInput) {
      return callJson<AtmReleaseTicketHoldResult>(
        brokerUrl,
        "POST",
        ATM_XRPC_METHODS.tickets.releaseTicketHold,
        input
      );
    },

    claimFreeTicket(input: AtmFreeTicketClaimInput) {
      return callJson<AtmFreeTicketClaimResult>(
        brokerUrl,
        "POST",
        ATM_XRPC_METHODS.tickets.claimFreeTicket,
        createFreeTicketClaimBody(input)
      );
    },

    listBuyerTickets(input: AtmListBuyerTicketsParams) {
      return callQuery<AtmListTicketsResult>(
        brokerUrl,
        ATM_XRPC_METHODS.tickets.listBuyerTickets,
        input
      );
    },

    listOrganizerTickets(input: AtmListOrganizerTicketsParams) {
      return callQuery<AtmListTicketsResult>(
        brokerUrl,
        ATM_XRPC_METHODS.tickets.listOrganizerTickets,
        input
      );
    },

    verifyTicket(input: AtmVerifyTicketInput) {
      return callJson<AtmVerifyTicketResult>(
        brokerUrl,
        "POST",
        ATM_XRPC_METHODS.tickets.verifyTicket,
        input
      );
    },

    checkInTicket(input: AtmTicketCheckInInput) {
      return callJson<AtmTicketCheckInResult>(
        brokerUrl,
        "POST",
        ATM_XRPC_METHODS.tickets.checkInTicket,
        input
      );
    },

    getProfile(actor: string) {
      return callQuery<AtmProfile>(
        appViewUrl,
        ATM_XRPC_METHODS.actor.getProfile,
        { actor }
      );
    },
  };
}

async function readAtmJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const json = text ? safeJsonParse(text) : null;
  if (!res.ok) {
    const message =
      json && typeof json === "object" && "message" in json
        ? String((json as { message: unknown }).message)
        : `ATM request failed with ${res.status}`;
    const error =
      json && typeof json === "object" && "error" in json
        ? String((json as { error: unknown }).error)
        : "AtmRequestFailed";
    throw new AtmApiError(error, message, res.status, json);
  }
  return json as T;
}

function constructWebhookHandlerEvent<
  TType extends AtmWebhookEventType | undefined,
>(
  rawBody: string,
  headers: AtmWebhookHeaders,
  options: AtmWebhookHandlerOptions<TType>
): AtmWebhookHandlerEvent<TType> {
  if (options.expectedType) {
    return constructTypedAtmWebhookEvent({
      rawBody,
      headers,
      secret: options.secret,
      toleranceSeconds: options.toleranceSeconds,
      now: options.now,
      expectedType: options.expectedType,
    }) as AtmWebhookHandlerEvent<TType>;
  }
  return constructAtmWebhookEvent({
    rawBody,
    headers,
    secret: options.secret,
    toleranceSeconds: options.toleranceSeconds,
    now: options.now,
  }) as AtmWebhookHandlerEvent<TType>;
}

function requestHeaders(request: Request): AtmWebhookHeaders {
  return {
    signature: request.headers.get("atm-signature"),
    deliveryId: request.headers.get("atm-delivery-id"),
    event: request.headers.get("atm-event"),
    apiVersion: request.headers.get("atm-api-version"),
    environment: request.headers.get("atm-environment"),
  };
}

function expressHeaders(
  headers: AtmExpressLikeRequest["headers"]
): AtmWebhookHeaders {
  return {
    signature: singleHeader(headers["atm-signature"]),
    deliveryId: singleHeader(headers["atm-delivery-id"]),
    event: singleHeader(headers["atm-event"]),
    apiVersion: singleHeader(headers["atm-api-version"]),
    environment: singleHeader(headers["atm-environment"]),
  };
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function defaultExpressRawBody(request: AtmExpressLikeRequest): string | Buffer {
  if (typeof request.rawBody === "string" || Buffer.isBuffer(request.rawBody)) {
    return request.rawBody;
  }
  if (typeof request.body === "string" || Buffer.isBuffer(request.body)) {
    return request.body;
  }
  throw new AtmWebhookSignatureError(
    "Express webhook handler requires rawBody, string body, or getRawBody"
  );
}

function normalizeWebhookHandlerResult(
  result: AtmWebhookHandlerResult
): Response {
  if (result instanceof Response) return result;
  const normalized = normalizePlainWebhookHandlerResult(result);
  return jsonResponse(normalized.status, normalized.body, normalized.headers);
}

function normalizePlainWebhookHandlerResult(
  result: AtmWebhookHandlerResult
): { status: number; body: unknown; headers?: Record<string, string> } {
  if (!result) return { status: 200, body: { ok: true } };
  if (result instanceof Response) {
    const headers: Record<string, string> = {};
    result.headers.forEach((value, name) => {
      headers[name] = value;
    });
    return {
      status: result.status,
      body: { ok: result.ok },
      headers,
    };
  }
  return {
    status: result.status ?? 200,
    body: result.body ?? { ok: true },
    headers: result.headers,
  };
}

function jsonResponse(
  status: number,
  body: unknown,
  headers?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

function sendExpressJson(
  response: AtmExpressLikeResponse,
  status: number,
  body: unknown,
  headers?: Record<string, string>
): void {
  for (const [name, value] of Object.entries(headers ?? {})) {
    response.setHeader?.(name, value);
  }
  response.status(status).json(body);
}

function defaultWebhookErrorResponse(error: unknown): Response {
  const normalized = defaultPlainWebhookError(error);
  return jsonResponse(normalized.status, normalized.body, normalized.headers);
}

function defaultPlainWebhookError(
  error: unknown
): { status: number; body: unknown; headers?: Record<string, string> } {
  if (error instanceof AtmWebhookSignatureError) {
    return {
      status: 400,
      body: { error: "AtmWebhookVerificationFailed", message: error.message },
    };
  }
  return {
    status: 500,
    body: { error: "AtmWebhookHandlerFailed", message: "Webhook handler failed" },
  };
}

export class AtmApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly body: unknown;

  constructor(code: string, message: string, status: number, body: unknown) {
    super(message);
    this.name = "AtmApiError";
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

export class AtmWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AtmWebhookSignatureError";
  }
}

export class AtmXrpcReceiverAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AtmXrpcReceiverAuthError";
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function parseAtmSignatureHeader(
  signature: string
): { timestamp: number; signatures: string[] } | null {
  const fields = new Map<string, string[]>();
  for (const piece of signature.split(/[,\s]+/)) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) return null;
    const key = trimmed.slice(0, eq).toLowerCase();
    const value = trimmed.slice(eq + 1);
    const values = fields.get(key) ?? [];
    values.push(value);
    fields.set(key, values);
  }

  const timestampRaw = fields.get("t")?.[0];
  const signatures = fields.get("v1") ?? [];
  if (!timestampRaw || signatures.length === 0) return null;
  const timestamp = Number.parseInt(timestampRaw, 10);
  if (!Number.isFinite(timestamp)) return null;
  return { timestamp, signatures };
}

function parseAtmEventEnvelope<TData>(rawBody: string): AtmWebhookEnvelope<TData> {
  const parsed = safeJsonParse(rawBody);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AtmXrpcReceiverAuthError("ATM event receiver body is not a JSON object");
  }
  const event = parsed as Partial<AtmWebhookEnvelope<TData>>;
  if (typeof event.id !== "string" || !event.id) {
    throw new AtmXrpcReceiverAuthError("ATM event receiver body is missing id");
  }
  if (typeof event.type !== "string" || !event.type) {
    throw new AtmXrpcReceiverAuthError("ATM event receiver body is missing type");
  }
  if (typeof event.apiVersion !== "string" || !event.apiVersion) {
    throw new AtmXrpcReceiverAuthError("ATM event receiver body is missing apiVersion");
  }
  if (event.environment !== "test" && event.environment !== "live") {
    throw new AtmXrpcReceiverAuthError("ATM event receiver body has invalid environment");
  }
  if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) {
    throw new AtmXrpcReceiverAuthError("ATM event receiver body is missing data");
  }
  return event as AtmWebhookEnvelope<TData>;
}

function assertOptionalEventHeaders(
  event: AtmWebhookEnvelope<unknown>,
  headers: {
    deliveryId?: string | null | undefined;
    event?: string | null | undefined;
    apiVersion?: string | null | undefined;
    environment?: string | null | undefined;
  }
) {
  if (headers.deliveryId && event.id !== headers.deliveryId) {
    throw new AtmXrpcReceiverAuthError(
      "ATM event receiver delivery id does not match the body"
    );
  }
  if (headers.event && event.type !== headers.event) {
    throw new AtmXrpcReceiverAuthError(
      "ATM event receiver type does not match the body"
    );
  }
  if (headers.apiVersion && event.apiVersion !== headers.apiVersion) {
    throw new AtmXrpcReceiverAuthError(
      "ATM event receiver API version does not match the body"
    );
  }
  if (headers.environment && event.environment !== headers.environment) {
    throw new AtmXrpcReceiverAuthError(
      "ATM event receiver environment does not match the body"
    );
  }
}

function bearerToken(authorization: string | null | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function receiverAudience(appDid: string, serviceRef: string): string {
  const normalized = normalizeReceiverServiceRef(appDid, serviceRef);
  return `${appDid}${normalized}`;
}

function normalizeReceiverServiceRef(appDid: string, serviceRef: string): string {
  const trimmed = serviceRef.trim();
  if (!trimmed) {
    throw new AtmXrpcReceiverAuthError("XRPC receiver serviceRef is required");
  }
  if (trimmed.startsWith(`${appDid}#`)) {
    const fragment = trimmed.slice(appDid.length);
    if (fragment.length <= 1) {
      throw new AtmXrpcReceiverAuthError("XRPC receiver serviceRef is invalid");
    }
    return fragment;
  }
  if (trimmed.startsWith("#")) {
    if (trimmed.length === 1) {
      throw new AtmXrpcReceiverAuthError("XRPC receiver serviceRef is invalid");
    }
    return trimmed;
  }
  if (trimmed.startsWith("did:")) {
    throw new AtmXrpcReceiverAuthError(
      "XRPC receiver serviceRef must belong to appDid"
    );
  }
  return `#${trimmed}`;
}

function assertDid(value: string, field: string) {
  if (!value.startsWith("did:")) {
    throw new Error(`${field} must be a DID`);
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeSecrets(value: string | readonly string[]): string[] {
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function pruneUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => pruneUndefined(item)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (inner !== undefined) out[key] = pruneUndefined(inner);
    }
    return out as T;
  }
  return value;
}
