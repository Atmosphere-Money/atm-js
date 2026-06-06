import { createHmac } from "node:crypto";

export type AtmTestEnvironment = "test" | "live";

export type AtmTestWebhookEventType =
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

export type AtmTestWebhookEnvelope<TData = Record<string, unknown>> = {
  id: string;
  type: AtmTestWebhookEventType;
  created: number;
  apiVersion: string;
  environment: AtmTestEnvironment;
  data: TData;
};

export type AtmSignedFixture<TData = Record<string, unknown>> = {
  event: AtmTestWebhookEnvelope<TData>;
  rawBody: string;
  headers: {
    "atm-signature": string;
    "atm-delivery-id": string;
    "atm-event": AtmTestWebhookEventType;
    "atm-api-version": string;
    "atm-environment": AtmTestEnvironment;
  };
};

export type AtmFixtureRequestOptions = {
  url?: string;
  method?: string;
  headers?: HeadersInit;
};

export type AtmPaymentCompletedFixtureData = {
  payment: {
    id: string;
    amountCents: number;
    currency: string;
    status: "completed";
    paymentType: "tip" | "shop" | "commission" | "subscribe" | "ticket";
    payerDid?: string;
    recipientDid: string;
    appDid: string;
    metadata: Record<string, unknown>;
  };
};

export type AtmPaymentFailedFixtureData = {
  payment: {
    id: string;
    amountCents: number;
    currency: string;
    status: "failed";
    paymentType: "tip" | "shop" | "commission" | "subscribe" | "ticket";
    payerDid?: string;
    recipientDid: string;
    appDid: string;
    failureCode: string;
    failureMessage: string;
    metadata: Record<string, unknown>;
  };
};

export type AtmPaymentRefundedFixtureData = {
  payment: {
    id: string;
    amountCents: number;
    refundedAmountCents: number;
    currency: string;
    status: "refunded";
    paymentType: "tip" | "shop" | "commission" | "subscribe" | "ticket";
    payerDid?: string;
    recipientDid: string;
    appDid: string;
    refundId: string;
    metadata: Record<string, unknown>;
  };
};

export type AtmPaymentDisputedFixtureData = {
  payment: {
    id: string;
    amountCents: number;
    currency: string;
    status: "disputed";
    paymentType: "tip" | "shop" | "commission" | "subscribe" | "ticket";
    payerDid?: string;
    recipientDid: string;
    appDid: string;
    disputeId: string;
    disputeStatus: "needs_response" | "under_review" | "won" | "lost";
    metadata: Record<string, unknown>;
  };
};

export type AtmSubscriptionUpdatedFixtureData = {
  subscription: {
    id: string;
    status: "active" | "past_due" | "cancelled";
    amountCents: number;
    previousAmountCents?: number;
    currency: string;
    interval: "month" | "quarter" | "year";
    payerDid?: string;
    recipientDid: string;
    appDid: string;
  };
};

export type AtmTicketsIssuedFixtureData = {
  eventUri: string;
  holdId: string;
  paymentId?: string;
  buyerDid?: string;
  issuedCount: number;
  tickets: Array<{
    ticketId: string;
    ticketTierId: string;
    status: "issued";
  }>;
};

export type AtmProductArchivedFixtureData = {
  product: {
    productUri: string;
    productCid?: string;
    appDid: string;
    creatorDid?: string;
    archivedAt: string;
    metadata: Record<string, unknown>;
  };
};

export type AtmTicketCheckedInFixtureData = {
  ticket: {
    ticketId: string;
    ticketTierId: string;
    eventUri: string;
    buyerDid?: string;
    checkInListId: string;
    checkedInAt: string;
    repeat: boolean;
    metadata: Record<string, unknown>;
  };
};

export type AtmFixtureOptions = {
  id?: string;
  deliveryId?: string;
  created?: number;
  apiVersion?: string;
  environment?: AtmTestEnvironment;
  secret?: string;
};

export type AtmReplayStore = {
  insertOnce(key: string): Promise<boolean> | boolean;
  has?(key: string): Promise<boolean> | boolean;
};

export const ATM_TEST_WEBHOOK_SECRET = "atm_whsec_test_fixture";
export const ATM_TEST_API_VERSION = "2026-05";
export const ATM_TEST_CREATED = 1_780_000_000;

export function createAtmEventFixture<TData>(
  options: AtmFixtureOptions & {
    type: AtmTestWebhookEventType;
    data: TData;
  }
): AtmSignedFixture<TData> {
  return createSignedFixture({
    type: options.type,
    options,
    data: options.data,
  });
}

export function createPaymentCompletedFixture(
  options: AtmFixtureOptions & {
    payment?: Partial<AtmPaymentCompletedFixtureData["payment"]>;
  } = {}
): AtmSignedFixture<AtmPaymentCompletedFixtureData> {
  return createAtmEventFixture({
    type: "payment.completed",
    ...options,
    data: {
      payment: {
        id: options.payment?.id ?? "pay_fixture_123",
        amountCents: options.payment?.amountCents ?? 1200,
        currency: options.payment?.currency ?? "usd",
        status: "completed",
        paymentType: options.payment?.paymentType ?? "shop",
        payerDid: options.payment?.payerDid ?? "did:plc:buyer",
        recipientDid: options.payment?.recipientDid ?? "did:plc:creator",
        appDid: options.payment?.appDid ?? "did:plc:app",
        metadata: options.payment?.metadata ?? { appOrderId: "ord_fixture_123" },
      },
    },
  });
}

export function createPaymentFailedFixture(
  options: AtmFixtureOptions & {
    payment?: Partial<AtmPaymentFailedFixtureData["payment"]>;
  } = {}
): AtmSignedFixture<AtmPaymentFailedFixtureData> {
  return createAtmEventFixture({
    type: "payment.failed",
    ...options,
    data: {
      payment: {
        id: options.payment?.id ?? "pay_fixture_failed",
        amountCents: options.payment?.amountCents ?? 1200,
        currency: options.payment?.currency ?? "usd",
        status: "failed",
        paymentType: options.payment?.paymentType ?? "shop",
        payerDid: options.payment?.payerDid ?? "did:plc:buyer",
        recipientDid: options.payment?.recipientDid ?? "did:plc:creator",
        appDid: options.payment?.appDid ?? "did:plc:app",
        failureCode: options.payment?.failureCode ?? "card_declined",
        failureMessage: options.payment?.failureMessage ?? "The payment was declined.",
        metadata: options.payment?.metadata ?? { appOrderId: "ord_fixture_failed" },
      },
    },
  });
}

export function createPaymentRefundedFixture(
  options: AtmFixtureOptions & {
    payment?: Partial<AtmPaymentRefundedFixtureData["payment"]>;
  } = {}
): AtmSignedFixture<AtmPaymentRefundedFixtureData> {
  return createAtmEventFixture({
    type: "payment.refunded",
    ...options,
    data: {
      payment: {
        id: options.payment?.id ?? "pay_fixture_refunded",
        amountCents: options.payment?.amountCents ?? 1200,
        refundedAmountCents: options.payment?.refundedAmountCents ?? 1200,
        currency: options.payment?.currency ?? "usd",
        status: "refunded",
        paymentType: options.payment?.paymentType ?? "shop",
        payerDid: options.payment?.payerDid ?? "did:plc:buyer",
        recipientDid: options.payment?.recipientDid ?? "did:plc:creator",
        appDid: options.payment?.appDid ?? "did:plc:app",
        refundId: options.payment?.refundId ?? "ref_fixture_123",
        metadata: options.payment?.metadata ?? { appOrderId: "ord_fixture_refunded" },
      },
    },
  });
}

export function createPaymentDisputedFixture(
  options: AtmFixtureOptions & {
    payment?: Partial<AtmPaymentDisputedFixtureData["payment"]>;
  } = {}
): AtmSignedFixture<AtmPaymentDisputedFixtureData> {
  return createAtmEventFixture({
    type: "payment.disputed",
    ...options,
    data: {
      payment: {
        id: options.payment?.id ?? "pay_fixture_disputed",
        amountCents: options.payment?.amountCents ?? 1200,
        currency: options.payment?.currency ?? "usd",
        status: "disputed",
        paymentType: options.payment?.paymentType ?? "shop",
        payerDid: options.payment?.payerDid ?? "did:plc:buyer",
        recipientDid: options.payment?.recipientDid ?? "did:plc:creator",
        appDid: options.payment?.appDid ?? "did:plc:app",
        disputeId: options.payment?.disputeId ?? "dp_fixture_123",
        disputeStatus: options.payment?.disputeStatus ?? "needs_response",
        metadata: options.payment?.metadata ?? { appOrderId: "ord_fixture_disputed" },
      },
    },
  });
}

export function createSubscriptionUpdatedFixture(
  options: AtmFixtureOptions & {
    subscription?: Partial<AtmSubscriptionUpdatedFixtureData["subscription"]>;
  } = {}
): AtmSignedFixture<AtmSubscriptionUpdatedFixtureData> {
  return createAtmEventFixture({
    type: "subscription.updated",
    ...options,
    data: {
      subscription: {
        id: options.subscription?.id ?? "sub_fixture_123",
        status: options.subscription?.status ?? "active",
        amountCents: options.subscription?.amountCents ?? 1500,
        previousAmountCents: options.subscription?.previousAmountCents ?? 500,
        currency: options.subscription?.currency ?? "usd",
        interval: options.subscription?.interval ?? "month",
        payerDid: options.subscription?.payerDid ?? "did:plc:buyer",
        recipientDid: options.subscription?.recipientDid ?? "did:plc:creator",
        appDid: options.subscription?.appDid ?? "did:plc:app",
      },
    },
  });
}

export function createTicketsIssuedFixture(
  options: AtmFixtureOptions & {
    ticket?: Partial<AtmTicketsIssuedFixtureData>;
  } = {}
): AtmSignedFixture<AtmTicketsIssuedFixtureData> {
  const tickets = options.ticket?.tickets ?? [
    {
      ticketId: "ticket_fixture_123",
      ticketTierId: "tier_fixture_general",
      status: "issued" as const,
    },
  ];
  return createAtmEventFixture({
    type: "tickets.issued",
    ...options,
    data: {
      eventUri:
        options.ticket?.eventUri ??
        "at://did:plc:organizer/community.lexicon.calendar.event/demo",
      holdId: options.ticket?.holdId ?? "hold_fixture_123",
      paymentId: options.ticket?.paymentId ?? "pay_fixture_123",
      buyerDid: options.ticket?.buyerDid ?? "did:plc:buyer",
      issuedCount: options.ticket?.issuedCount ?? tickets.length,
      tickets,
    },
  });
}

export function createProductArchivedFixture(
  options: AtmFixtureOptions & {
    product?: Partial<AtmProductArchivedFixtureData["product"]>;
  } = {}
): AtmSignedFixture<AtmProductArchivedFixtureData> {
  const product: AtmProductArchivedFixtureData["product"] = {
    productUri:
      options.product?.productUri ??
      "at://did:plc:creator/money.atmosphere.product/product_fixture",
    appDid: options.product?.appDid ?? "did:plc:app",
    archivedAt: options.product?.archivedAt ?? "2026-05-01T12:00:00.000Z",
    metadata: options.product?.metadata ?? { reason: "creator_archived" },
  };
  if (options.product?.productCid !== undefined) product.productCid = options.product.productCid;
  if (options.product?.creatorDid !== undefined) product.creatorDid = options.product.creatorDid;
  return createAtmEventFixture({
    type: "product.archived",
    ...options,
    data: { product },
  });
}

export function createTicketCheckedInFixture(
  options: AtmFixtureOptions & {
    ticket?: Partial<AtmTicketCheckedInFixtureData["ticket"]>;
  } = {}
): AtmSignedFixture<AtmTicketCheckedInFixtureData> {
  const ticket: AtmTicketCheckedInFixtureData["ticket"] = {
    ticketId: options.ticket?.ticketId ?? "ticket_fixture_123",
    ticketTierId: options.ticket?.ticketTierId ?? "tier_fixture_general",
    eventUri:
      options.ticket?.eventUri ??
      "at://did:plc:organizer/community.lexicon.calendar.event/demo",
    checkInListId: options.ticket?.checkInListId ?? "checklist_fixture_123",
    checkedInAt: options.ticket?.checkedInAt ?? "2026-05-01T12:00:00.000Z",
    repeat: options.ticket?.repeat ?? false,
    metadata: options.ticket?.metadata ?? { scannerId: "scanner_fixture_123" },
  };
  if (options.ticket?.buyerDid !== undefined) ticket.buyerDid = options.ticket.buyerDid;
  return createAtmEventFixture({
    type: "ticket.checked_in",
    ...options,
    data: { ticket },
  });
}

export function signAtmFixture(options: {
  rawBody: string;
  deliveryId: string;
  secret?: string;
  timestamp?: number;
}): string {
  const timestamp = options.timestamp ?? ATM_TEST_CREATED;
  const secret = options.secret ?? ATM_TEST_WEBHOOK_SECRET;
  const signedPayload = `${timestamp}.${options.deliveryId}.${options.rawBody}`;
  const digest = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

export function createMemoryReplayStore(initialKeys: Iterable<string> = []): AtmReplayStore {
  const seen = new Set(initialKeys);
  return {
    insertOnce(key) {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
    has(key) {
      return seen.has(key);
    },
  };
}

export function createAtmWebhookRequest<TData>(
  fixture: AtmSignedFixture<TData>,
  options: AtmFixtureRequestOptions = {}
): Request {
  const headers = new Headers(options.headers);
  for (const [name, value] of Object.entries(fixture.headers)) {
    headers.set(name, value);
  }
  return new Request(options.url ?? "https://app.example/webhooks/atm", {
    method: options.method ?? "POST",
    headers,
    body: fixture.rawBody,
  });
}

export async function assertFreshDelivery(
  store: AtmReplayStore,
  deliveryId: string
): Promise<void> {
  const inserted = await store.insertOnce(deliveryId);
  if (!inserted) {
    throw new Error(`Duplicate ATM delivery id: ${deliveryId}`);
  }
}

export function createAtmIdempotencyKey(parts: Array<string | number | boolean | null | undefined>): string {
  const normalized = parts
    .filter((part) => part !== null && part !== undefined && part !== "")
    .map((part) => String(part).trim())
    .join(":");
  if (!normalized) {
    throw new Error("At least one idempotency key part is required");
  }
  return `atm:test:${normalized}`;
}

function createSignedFixture<TData>({
  type,
  options,
  data,
}: {
  type: AtmTestWebhookEventType;
  options: AtmFixtureOptions;
  data: TData;
}): AtmSignedFixture<TData> {
  const deliveryId =
    options.deliveryId ?? options.id ?? `del_${type.replace(".", "_")}_fixture`;
  const id = options.id ?? deliveryId;
  const created = options.created ?? ATM_TEST_CREATED;
  const apiVersion = options.apiVersion ?? ATM_TEST_API_VERSION;
  const environment = options.environment ?? "test";
  const event: AtmTestWebhookEnvelope<TData> = {
    id,
    type,
    created,
    apiVersion,
    environment,
    data,
  };
  const rawBody = JSON.stringify(event);
  const signatureOptions: {
    rawBody: string;
    deliveryId: string;
    secret?: string;
    timestamp: number;
  } = {
    rawBody,
    deliveryId,
    timestamp: created,
  };
  if (options.secret !== undefined) signatureOptions.secret = options.secret;
  const signature = signAtmFixture(signatureOptions);
  return {
    event,
    rawBody,
    headers: {
      "atm-signature": signature,
      "atm-delivery-id": deliveryId,
      "atm-event": type,
      "atm-api-version": apiVersion,
      "atm-environment": environment,
    },
  };
}
