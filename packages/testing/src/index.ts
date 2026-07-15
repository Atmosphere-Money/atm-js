import { createHmac } from "node:crypto";

export type AtmTestEnvironment = "test" | "live";

/**
 * Every documented ATM event type — kept in lockstep with the published
 * `money.atmosphere.event.receive` lexicon `#eventType` knownValues (the
 * package test asserts exact coverage against the lexicon).
 */
export type AtmTestWebhookEventType =
  | "app.webhook.test"
  | "payment.completed"
  | "payment.failed"
  | "payment.refunded"
  | "payment.refund-updated"
  | "payment.disputed"
  | "payment.dispute-closed"
  | "subscription.invoice-paid"
  | "subscription.updated"
  | "subscription.canceled"
  | "subscription.payment-failed"
  | "subscription.recovered"
  | "pledge.created"
  | "pledge.canceled"
  | "pledge.converted"
  | "pledge.conversion-failed"
  | "payer.record.requested"
  | "payer.claimed"
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
  | "ticket.checked-in"
  | "ticket.form-submitted"
  | "ticket.waitlist.joined"
  | "ticket.waitlist.offered"
  | "ticket.collaboration.invited"
  | "ticket.collaboration.accepted"
  | "ticket.collaboration.revoked"
  | "customer.segment.message-requested"
  | "recipient.authorization.updated";

export type AtmTestWebhookEnvelope<TData = Record<string, unknown>> = {
  id: string;
  type: AtmTestWebhookEventType;
  /** ISO 8601 datetime the envelope was built (webhook apiVersion 2026-07+). */
  createdAt: string;
  apiVersion: string;
  environment: AtmTestEnvironment;
  data: AtmTestEventData<TData>;
};

export type AtmSignedFixture<TData = Record<string, unknown>> = {
  event: AtmTestWebhookEnvelope<TData>;
  rawBody: string;
  /**
   * Unix seconds used for the `t=` component of `atm-signature`. Pass this as
   * `now` to signature verifiers for deterministic tests — the envelope itself
   * carries `createdAt` as an ISO datetime, not unix seconds.
   */
  signatureTimestamp: number;
  headers: {
    "atm-signature": string;
    "atm-delivery-id": string;
    "atm-event": AtmTestWebhookEventType;
    "atm-api-version": string;
    "atm-environment": AtmTestEnvironment;
  };
};

export type AtmTestEventData<TData = Record<string, unknown>> = TData & {
  $type: string;
};

export type AtmFixtureRequestOptions = {
  url?: string;
  method?: string;
  headers?: HeadersInit;
};

export type AtmTestPaymentType =
  | "tip"
  | "shop"
  | "commission"
  | "subscribe"
  | "ticket";

/**
 * Wire-shaped payment summary (webhook apiVersion 2026-07). `amount` is in the
 * smallest currency unit — the 2026-07 flag day renamed `amountCents` to
 * `amount` across the published contract.
 */
export type AtmTestPaymentSummary<TStatus extends string = string> = {
  id: string;
  amount: number;
  currency: string;
  status: TStatus;
  paymentType: AtmTestPaymentType;
  payerDid?: string;
  recipientDid: string;
  metadata: Record<string, unknown>;
};

export type AtmPaymentCompletedFixtureData = {
  payment: AtmTestPaymentSummary<"completed">;
};

export type AtmPaymentFailedFixtureData = {
  payment: AtmTestPaymentSummary<"failed">;
  /** Failure reason (e.g. `card_declined`) — top-level, like the live payload. */
  reason?: string;
};

export type AtmPaymentRefundedFixtureData = {
  payment: AtmTestPaymentSummary<"refunded">;
  /** Amount refunded by this refund, in the smallest currency unit. */
  amount: number;
  /** Cumulative refunded amount for the payment, in the smallest currency unit. */
  amountRefundedTotal: number;
  partial: boolean;
  reason?: string;
  distribution?: { planned: number };
};

export type AtmPaymentDisputedFixtureData = {
  payment: AtmTestPaymentSummary<"disputed">;
  /** Stripe-shaped dispute status (e.g. `needs_response`, `under_review`). */
  status?: "needs_response" | "under_review" | "won" | "lost";
  disputeReason?: string;
};

export type AtmSubscriptionUpdatedFixtureData = {
  subscription: {
    id: string;
    status: "active" | "past_due" | "canceled";
    processorSubscriptionId?: string;
  };
  payment: AtmTestPaymentSummary;
  /** Prior per-cycle amount in the smallest currency unit. */
  priorAmount: number;
  /** New per-cycle amount in the smallest currency unit. */
  amount: number;
  currency: string;
  updatedAt: string;
  updatedBy: { actor: string; did?: string };
  currentPeriodEnd?: string | null;
};

export type AtmSubscriptionPaymentFailedFixtureData = {
  subscription: {
    id: string;
    status: "past_due";
    processorSubscriptionId?: string;
  };
  payment: AtmTestPaymentSummary<"failed">;
  invoiceId: string;
  reason: string;
  hostedInvoiceUrl?: string;
  failedAt: string;
};

export type AtmSubscriptionRecoveredFixtureData = {
  subscription: {
    id: string;
    status: "active";
    processorSubscriptionId?: string;
  };
  payment: AtmTestPaymentSummary<"completed">;
  invoiceId: string;
  recoveredAt: string;
};

export type AtmTicketsIssuedFixtureData = {
  paymentId?: string;
  claimId?: string;
  hold: {
    id: string;
    eventId: string;
    amount?: number;
    currency?: string;
    quantityTotal?: number;
    items?: Array<{
      tierId: string;
      title?: string;
      quantity?: number;
      unitAmount?: number;
      currency?: string;
    }>;
  };
  tickets: Array<{
    id: string;
    eventId: string;
    tierId: string;
    paymentId?: string;
    claimId?: string;
    status: "issued";
  }>;
};

export type AtmProductArchivedFixtureData = {
  product: {
    uri: string;
    cid?: string;
    title?: string;
  };
  creatorDid?: string;
  appLink?: Record<string, unknown>;
};

export type AtmTicketCheckedInFixtureData = {
  ticket: {
    id: string;
    eventId: string;
    tierId: string;
    paymentId?: string;
    claimId?: string;
    status: string;
  };
  checkIn: {
    id: string;
    checkInListId?: string;
    scannerDid?: string;
    checkedInAt: string;
  };
};

export type AtmFixtureOptions = {
  id?: string;
  deliveryId?: string;
  /** Envelope `createdAt` (ISO 8601). Defaults to `ATM_TEST_CREATED_AT`. */
  createdAt?: string;
  /**
   * Unix seconds for the signature `t=` component. Defaults to the unix
   * equivalent of `createdAt`.
   */
  signatureTimestamp?: number;
  apiVersion?: string;
  environment?: AtmTestEnvironment;
  secret?: string;
};

/**
 * @deprecated This insert-only shape cannot model fulfillment failure or
 * release. Use `AtmTestWebhookDeliveryStore` / `createMemoryDeliveryStore`.
 */
export type AtmReplayStore = {
  insertOnce(key: string): Promise<boolean> | boolean;
  has?(key: string): Promise<boolean> | boolean;
};

export type AtmTestWebhookDeliveryClaimResult =
  | { status: "claimed"; claimId: string }
  | { status: "completed" }
  | { status: "busy" };

/**
 * Process-local delivery lifecycle for route tests. Its method shape is
 * assignable to app-node's `AtmWebhookDeliveryStore`.
 *
 * Production apps must implement the same transitions in durable shared
 * storage with an expiring lease and exact claim-id fencing.
 */
export type AtmTestWebhookDeliveryStore = {
  claim(deliveryId: string): AtmTestWebhookDeliveryClaimResult;
  complete(deliveryId: string, claimId: string): void;
  release(deliveryId: string, claimId: string): void;
  getStatus(deliveryId: string): "busy" | "completed" | undefined;
};

export const ATM_TEST_WEBHOOK_SECRET = "atm_whsec_test_fixture";
export const ATM_TEST_API_VERSION = "2026-07";
/** Deterministic fixture signing time as unix seconds (the signature `t=`). */
export const ATM_TEST_CREATED = 1_780_000_000;
/** The same instant as `ATM_TEST_CREATED`, as the envelope `createdAt` ISO datetime. */
export const ATM_TEST_CREATED_AT = new Date(
  ATM_TEST_CREATED * 1000
).toISOString();

export const ATM_TEST_EVENT_PAYLOAD_TYPES: Record<AtmTestWebhookEventType, string> = {
  "app.webhook.test": "money.atmosphere.event.receive#appWebhookTest",
  "payment.completed": "money.atmosphere.event.receive#paymentCompleted",
  "payment.failed": "money.atmosphere.event.receive#paymentFailed",
  "payment.refunded": "money.atmosphere.event.receive#paymentRefunded",
  "payment.refund-updated": "money.atmosphere.event.receive#paymentRefundUpdated",
  "payment.disputed": "money.atmosphere.event.receive#paymentDisputed",
  "payment.dispute-closed": "money.atmosphere.event.receive#paymentDisputeClosed",
  "subscription.invoice-paid": "money.atmosphere.event.receive#subscriptionInvoicePaid",
  "subscription.updated": "money.atmosphere.event.receive#subscriptionUpdated",
  "subscription.canceled": "money.atmosphere.event.receive#subscriptionCanceled",
  "subscription.payment-failed": "money.atmosphere.event.receive#subscriptionPaymentFailed",
  "subscription.recovered": "money.atmosphere.event.receive#subscriptionRecovered",
  "pledge.created": "money.atmosphere.event.receive#pledgeCreated",
  "pledge.canceled": "money.atmosphere.event.receive#pledgeCanceled",
  "pledge.converted": "money.atmosphere.event.receive#pledgeConverted",
  "pledge.conversion-failed": "money.atmosphere.event.receive#pledgeConversionFailed",
  "payer.record.requested": "money.atmosphere.event.receive#payerRecordRequested",
  "payer.claimed": "money.atmosphere.event.receive#payerClaimed",
  "creator.proof.requested": "money.atmosphere.event.receive#creatorProofRequested",
  "attestation.updated": "money.atmosphere.event.receive#attestationUpdated",
  "product.updated": "money.atmosphere.event.receive#productUpdated",
  "product.archived": "money.atmosphere.event.receive#productArchived",
  "product.deleted": "money.atmosphere.event.receive#productDeleted",
  "ticket.hold.created": "money.atmosphere.event.receive#ticketHoldCreated",
  "ticket.hold.expired": "money.atmosphere.event.receive#ticketHoldExpired",
  "tickets.issued": "money.atmosphere.event.receive#ticketsIssued",
  "ticket.voided": "money.atmosphere.event.receive#ticketVoided",
  "ticket.refunded": "money.atmosphere.event.receive#ticketRefunded",
  "ticket.checked-in": "money.atmosphere.event.receive#ticketCheckedIn",
  "ticket.form-submitted": "money.atmosphere.event.receive#ticketFormSubmitted",
  "ticket.waitlist.joined": "money.atmosphere.event.receive#ticketWaitlistJoined",
  "ticket.waitlist.offered": "money.atmosphere.event.receive#ticketWaitlistOffered",
  "ticket.collaboration.invited":
    "money.atmosphere.event.receive#ticketCollaborationInvited",
  "ticket.collaboration.accepted":
    "money.atmosphere.event.receive#ticketCollaborationAccepted",
  "ticket.collaboration.revoked":
    "money.atmosphere.event.receive#ticketCollaborationRevoked",
  "customer.segment.message-requested":
    "money.atmosphere.event.receive#customerSegmentMessageRequested",
  "recipient.authorization.updated":
    "money.atmosphere.event.receive#recipientAuthorizationUpdated",
};

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

function paymentSummary<TStatus extends string>(
  status: TStatus,
  overrides: Partial<AtmTestPaymentSummary> | undefined,
  defaults: { id: string; orderId: string; paymentType?: AtmTestPaymentType }
): AtmTestPaymentSummary<TStatus> {
  return {
    id: overrides?.id ?? defaults.id,
    amount: overrides?.amount ?? 1200,
    currency: overrides?.currency ?? "usd",
    status,
    paymentType: overrides?.paymentType ?? defaults.paymentType ?? "shop",
    payerDid: overrides?.payerDid ?? "did:plc:buyer",
    recipientDid: overrides?.recipientDid ?? "did:plc:creator",
    metadata: overrides?.metadata ?? { appOrderId: defaults.orderId },
  };
}

export function createPaymentCompletedFixture(
  options: AtmFixtureOptions & {
    payment?: Partial<AtmTestPaymentSummary>;
  } = {}
): AtmSignedFixture<AtmPaymentCompletedFixtureData> {
  return createAtmEventFixture({
    type: "payment.completed",
    ...options,
    data: {
      payment: paymentSummary("completed", options.payment, {
        id: "pay_fixture_123",
        orderId: "ord_fixture_123",
      }),
    },
  });
}

export function createPaymentFailedFixture(
  options: AtmFixtureOptions & {
    payment?: Partial<AtmTestPaymentSummary>;
    reason?: string;
  } = {}
): AtmSignedFixture<AtmPaymentFailedFixtureData> {
  return createAtmEventFixture({
    type: "payment.failed",
    ...options,
    data: {
      payment: paymentSummary("failed", options.payment, {
        id: "pay_fixture_failed",
        orderId: "ord_fixture_failed",
      }),
      reason: options.reason ?? "card_declined",
    },
  });
}

export function createPaymentRefundedFixture(
  options: AtmFixtureOptions & {
    payment?: Partial<AtmTestPaymentSummary>;
    amount?: number;
    amountRefundedTotal?: number;
    partial?: boolean;
    reason?: string;
  } = {}
): AtmSignedFixture<AtmPaymentRefundedFixtureData> {
  const payment = paymentSummary("refunded", options.payment, {
    id: "pay_fixture_refunded",
    orderId: "ord_fixture_refunded",
  });
  const amountRefundedTotal = options.amountRefundedTotal ?? payment.amount;
  return createAtmEventFixture({
    type: "payment.refunded",
    ...options,
    data: {
      payment,
      amount: options.amount ?? amountRefundedTotal,
      amountRefundedTotal,
      partial: options.partial ?? amountRefundedTotal < payment.amount,
      reason: options.reason ?? "refunded",
      distribution: { planned: 0 },
    },
  });
}

export function createPaymentDisputedFixture(
  options: AtmFixtureOptions & {
    payment?: Partial<AtmTestPaymentSummary>;
    status?: AtmPaymentDisputedFixtureData["status"];
    disputeReason?: string;
  } = {}
): AtmSignedFixture<AtmPaymentDisputedFixtureData> {
  return createAtmEventFixture({
    type: "payment.disputed",
    ...options,
    data: {
      payment: paymentSummary("disputed", options.payment, {
        id: "pay_fixture_disputed",
        orderId: "ord_fixture_disputed",
      }),
      status: options.status ?? "needs_response",
      disputeReason: options.disputeReason ?? "fraudulent",
    },
  });
}

export function createSubscriptionUpdatedFixture(
  options: AtmFixtureOptions & {
    subscription?: Partial<AtmSubscriptionUpdatedFixtureData["subscription"]>;
    payment?: Partial<AtmTestPaymentSummary>;
    priorAmount?: number;
    amount?: number;
    currency?: string;
    updatedAt?: string;
    updatedBy?: AtmSubscriptionUpdatedFixtureData["updatedBy"];
  } = {}
): AtmSignedFixture<AtmSubscriptionUpdatedFixtureData> {
  const amount = options.amount ?? 1500;
  const payment = paymentSummary("completed", { amount, ...options.payment }, {
    id: "pay_fixture_sub_123",
    orderId: "ord_fixture_sub_123",
    paymentType: "subscribe",
  });
  const subscription: AtmSubscriptionUpdatedFixtureData["subscription"] = {
    id: options.subscription?.id ?? "sub_fixture_123",
    status: options.subscription?.status ?? "active",
  };
  if (options.subscription?.processorSubscriptionId !== undefined) {
    subscription.processorSubscriptionId =
      options.subscription.processorSubscriptionId;
  }
  return createAtmEventFixture({
    type: "subscription.updated",
    ...options,
    data: {
      subscription,
      payment,
      priorAmount: options.priorAmount ?? 500,
      amount,
      currency: options.currency ?? payment.currency,
      updatedAt: options.updatedAt ?? "2026-07-01T12:00:00.000Z",
      updatedBy: options.updatedBy ?? { actor: "payer", did: "did:plc:buyer" },
    },
  });
}

export function createSubscriptionPaymentFailedFixture(
  options: AtmFixtureOptions & {
    subscription?: Partial<AtmSubscriptionPaymentFailedFixtureData["subscription"]>;
    payment?: Partial<AtmTestPaymentSummary>;
    invoiceId?: string;
    reason?: string;
    hostedInvoiceUrl?: string;
    failedAt?: string;
  } = {}
): AtmSignedFixture<AtmSubscriptionPaymentFailedFixtureData> {
  const subscription: AtmSubscriptionPaymentFailedFixtureData["subscription"] = {
    id: options.subscription?.id ?? "sub_fixture_123",
    status: "past_due",
  };
  if (options.subscription?.processorSubscriptionId !== undefined) {
    subscription.processorSubscriptionId = options.subscription.processorSubscriptionId;
  }
  const data: AtmSubscriptionPaymentFailedFixtureData = {
    subscription,
    payment: paymentSummary("failed", { amount: 1500, ...options.payment }, {
      id: "pay_fixture_renewal_failed",
      orderId: "ord_fixture_renewal_failed",
      paymentType: "subscribe",
    }),
    invoiceId: options.invoiceId ?? "in_fixture_renewal_failed",
    reason: options.reason ?? "card_declined",
    failedAt: options.failedAt ?? "2026-07-01T12:00:00.000Z",
  };
  if (options.hostedInvoiceUrl !== undefined) data.hostedInvoiceUrl = options.hostedInvoiceUrl;
  return createAtmEventFixture({
    type: "subscription.payment-failed",
    ...options,
    data,
  });
}

export function createSubscriptionRecoveredFixture(
  options: AtmFixtureOptions & {
    subscription?: Partial<AtmSubscriptionRecoveredFixtureData["subscription"]>;
    payment?: Partial<AtmTestPaymentSummary>;
    invoiceId?: string;
    recoveredAt?: string;
  } = {}
): AtmSignedFixture<AtmSubscriptionRecoveredFixtureData> {
  const subscription: AtmSubscriptionRecoveredFixtureData["subscription"] = {
    id: options.subscription?.id ?? "sub_fixture_123",
    status: "active",
  };
  if (options.subscription?.processorSubscriptionId !== undefined) {
    subscription.processorSubscriptionId = options.subscription.processorSubscriptionId;
  }
  return createAtmEventFixture({
    type: "subscription.recovered",
    ...options,
    data: {
      subscription,
      payment: paymentSummary("completed", { amount: 1500, ...options.payment }, {
        id: "pay_fixture_renewal_recovered",
        orderId: "ord_fixture_renewal_recovered",
        paymentType: "subscribe",
      }),
      invoiceId: options.invoiceId ?? "in_fixture_renewal_recovered",
      recoveredAt: options.recoveredAt ?? "2026-07-02T12:00:00.000Z",
    },
  });
}

export type AtmTestPledgeSummary = {
  id: string;
  recipientDid: string;
  payerDid?: string;
  amount: number;
  currency: string;
  interval: "month" | "quarter" | "year";
  tierLabel?: string;
  subscriptionGroupKey?: string;
  status:
    | "pending_setup"
    | "active"
    | "converting"
    | "converted"
    | "canceled"
    | "superseded"
    | "failed"
    | "expired";
  autoConvert: boolean;
  createdAt: string;
  canceledAt?: string;
  canceledBy?: string;
  convertedAt?: string;
};

function pledgeSummary(
  overrides: Partial<AtmTestPledgeSummary> = {}
): AtmTestPledgeSummary {
  return {
    id: "plg_fixture_123",
    recipientDid: "did:plc:fixturecreator",
    amount: 500,
    currency: "usd",
    interval: "month",
    status: "active",
    autoConvert: true,
    createdAt: "2026-07-01T12:00:00.000Z",
    ...overrides,
  };
}

export function createPledgeCreatedFixture(
  options: AtmFixtureOptions & { pledge?: Partial<AtmTestPledgeSummary> } = {}
): AtmSignedFixture<{ pledge: AtmTestPledgeSummary }> {
  return createAtmEventFixture({
    type: "pledge.created",
    ...options,
    data: { pledge: pledgeSummary(options.pledge) },
  });
}

export function createPledgeCanceledFixture(
  options: AtmFixtureOptions & { pledge?: Partial<AtmTestPledgeSummary> } = {}
): AtmSignedFixture<{ pledge: AtmTestPledgeSummary }> {
  return createAtmEventFixture({
    type: "pledge.canceled",
    ...options,
    data: {
      pledge: pledgeSummary({
        status: "canceled",
        canceledAt: "2026-07-02T12:00:00.000Z",
        canceledBy: "payer",
        ...options.pledge,
      }),
    },
  });
}

export function createPledgeConvertedFixture(
  options: AtmFixtureOptions & {
    pledge?: Partial<AtmTestPledgeSummary>;
    paymentId?: string;
    subscriptionId?: string;
  } = {}
): AtmSignedFixture<{
  pledge: AtmTestPledgeSummary;
  paymentId: string;
  subscriptionId?: string;
}> {
  return createAtmEventFixture({
    type: "pledge.converted",
    ...options,
    data: {
      pledge: pledgeSummary({
        status: "converted",
        convertedAt: "2026-07-02T12:00:00.000Z",
        ...options.pledge,
      }),
      paymentId: options.paymentId ?? "pay_fixture_pledge_123",
      subscriptionId: options.subscriptionId ?? "sub_fixture_pledge_123",
    },
  });
}

export function createPledgeConversionFailedFixture(
  options: AtmFixtureOptions & {
    pledge?: Partial<AtmTestPledgeSummary>;
    reasonCode?: string;
    willRetry?: boolean;
  } = {}
): AtmSignedFixture<{
  pledge: AtmTestPledgeSummary;
  reasonCode: string;
  willRetry: boolean;
}> {
  return createAtmEventFixture({
    type: "pledge.conversion-failed",
    ...options,
    data: {
      pledge: pledgeSummary({ status: "failed", ...options.pledge }),
      reasonCode: options.reasonCode ?? "payer_declined",
      willRetry: options.willRetry ?? false,
    },
  });
}

export function createTicketsIssuedFixture(
  options: AtmFixtureOptions & {
    issuance?: Partial<AtmTicketsIssuedFixtureData>;
  } = {}
): AtmSignedFixture<AtmTicketsIssuedFixtureData> {
  const tickets = options.issuance?.tickets ?? [
    {
      id: "ticket_fixture_123",
      eventId: "event_fixture_123",
      tierId: "tier_fixture_general",
      paymentId: "pay_fixture_123",
      status: "issued" as const,
    },
  ];
  const data: AtmTicketsIssuedFixtureData = {
    paymentId: options.issuance?.paymentId ?? "pay_fixture_123",
    hold: options.issuance?.hold ?? {
      id: "hold_fixture_123",
      eventId: "event_fixture_123",
      amount: 2400,
      currency: "usd",
      quantityTotal: tickets.length,
      items: [
        {
          tierId: "tier_fixture_general",
          title: "General admission",
          quantity: tickets.length,
          unitAmount: 1200,
          currency: "usd",
        },
      ],
    },
    tickets,
  };
  if (options.issuance?.claimId !== undefined) {
    data.claimId = options.issuance.claimId;
  }
  return createAtmEventFixture({
    type: "tickets.issued",
    ...options,
    data,
  });
}

export function createProductArchivedFixture(
  options: AtmFixtureOptions & {
    product?: Partial<AtmProductArchivedFixtureData["product"]>;
    creatorDid?: string;
    appLink?: Record<string, unknown>;
  } = {}
): AtmSignedFixture<AtmProductArchivedFixtureData> {
  const product: AtmProductArchivedFixtureData["product"] = {
    uri:
      options.product?.uri ??
      "at://did:plc:creator/money.atmosphere.product/product_fixture",
    title: options.product?.title ?? "Fixture product",
  };
  if (options.product?.cid !== undefined) product.cid = options.product.cid;
  const data: AtmProductArchivedFixtureData = {
    product,
    creatorDid: options.creatorDid ?? "did:plc:creator",
  };
  if (options.appLink !== undefined) data.appLink = options.appLink;
  return createAtmEventFixture({
    type: "product.archived",
    ...options,
    data,
  });
}

export function createTicketCheckedInFixture(
  options: AtmFixtureOptions & {
    ticket?: Partial<AtmTicketCheckedInFixtureData["ticket"]>;
    checkIn?: Partial<AtmTicketCheckedInFixtureData["checkIn"]>;
  } = {}
): AtmSignedFixture<AtmTicketCheckedInFixtureData> {
  const ticket: AtmTicketCheckedInFixtureData["ticket"] = {
    id: options.ticket?.id ?? "ticket_fixture_123",
    eventId: options.ticket?.eventId ?? "event_fixture_123",
    tierId: options.ticket?.tierId ?? "tier_fixture_general",
    status: options.ticket?.status ?? "checked_in",
  };
  if (options.ticket?.paymentId !== undefined) ticket.paymentId = options.ticket.paymentId;
  if (options.ticket?.claimId !== undefined) ticket.claimId = options.ticket.claimId;
  const checkIn: AtmTicketCheckedInFixtureData["checkIn"] = {
    id: options.checkIn?.id ?? "checkin_fixture_123",
    checkInListId: options.checkIn?.checkInListId ?? "checklist_fixture_123",
    checkedInAt: options.checkIn?.checkedInAt ?? "2026-07-01T12:00:00.000Z",
  };
  if (options.checkIn?.scannerDid !== undefined) checkIn.scannerDid = options.checkIn.scannerDid;
  return createAtmEventFixture({
    type: "ticket.checked-in",
    ...options,
    data: { ticket, checkIn },
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

/**
 * Build a process-local claim → complete/release store for webhook route tests.
 * This is deliberately not a production store: it is not shared, persistent,
 * or lease-expiring.
 */
export function createMemoryDeliveryStore(
  initialCompletedDeliveryIds: Iterable<string> = []
): AtmTestWebhookDeliveryStore {
  const deliveries = new Map<
    string,
    { status: "claimed"; claimId: string } | { status: "completed" }
  >();
  for (const deliveryId of initialCompletedDeliveryIds) {
    deliveries.set(deliveryId, { status: "completed" });
  }
  let claimSequence = 0;

  function ownedClaim(deliveryId: string, claimId: string) {
    const current = deliveries.get(deliveryId);
    if (current?.status !== "claimed" || current.claimId !== claimId) {
      throw new Error(
        `ATM delivery claim is stale or not owned: ${deliveryId}`
      );
    }
    return current;
  }

  return {
    claim(deliveryId) {
      const current = deliveries.get(deliveryId);
      if (current?.status === "completed") return { status: "completed" };
      if (current?.status === "claimed") return { status: "busy" };
      claimSequence += 1;
      const claimId = `test-claim-${claimSequence}`;
      deliveries.set(deliveryId, { status: "claimed", claimId });
      return { status: "claimed", claimId };
    },
    complete(deliveryId, claimId) {
      ownedClaim(deliveryId, claimId);
      deliveries.set(deliveryId, { status: "completed" });
    },
    release(deliveryId, claimId) {
      ownedClaim(deliveryId, claimId);
      deliveries.delete(deliveryId);
    },
    getStatus(deliveryId) {
      const current = deliveries.get(deliveryId);
      if (current?.status === "claimed") return "busy";
      return current?.status;
    },
  };
}

/**
 * @deprecated Insert-before-fulfillment dedupe can permanently suppress a
 * failed delivery. Use `createMemoryDeliveryStore` and exercise the complete /
 * release lifecycle instead.
 */
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

/**
 * @deprecated Do not use this as a fulfillment gate. It cannot release a
 * failed attempt. Use `createMemoryDeliveryStore`.
 */
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
  const createdAt = options.createdAt ?? ATM_TEST_CREATED_AT;
  const signatureTimestamp =
    options.signatureTimestamp ?? unixSecondsFrom(createdAt);
  const apiVersion = options.apiVersion ?? ATM_TEST_API_VERSION;
  const environment = options.environment ?? "test";
  const typedData = addEventPayloadType(type, data);
  const event: AtmTestWebhookEnvelope<TData> = {
    id,
    type,
    createdAt,
    apiVersion,
    environment,
    data: typedData,
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
    timestamp: signatureTimestamp,
  };
  if (options.secret !== undefined) signatureOptions.secret = options.secret;
  const signature = signAtmFixture(signatureOptions);
  return {
    event,
    rawBody,
    signatureTimestamp,
    headers: {
      "atm-signature": signature,
      "atm-delivery-id": deliveryId,
      "atm-event": type,
      "atm-api-version": apiVersion,
      "atm-environment": environment,
    },
  };
}

function unixSecondsFrom(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid createdAt datetime: ${iso}`);
  }
  return Math.floor(ms / 1000);
}

function addEventPayloadType<TData>(
  type: AtmTestWebhookEventType,
  data: TData
): AtmTestEventData<TData> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("ATM fixture data must be an object");
  }
  return {
    ...(data as Record<string, unknown>),
    $type: ATM_TEST_EVENT_PAYLOAD_TYPES[type],
  } as AtmTestEventData<TData>;
}
