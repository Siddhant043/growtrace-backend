import {
  SubscriptionModel,
  type SubscriptionDocument,
} from "../api/models/subscription.model.js";
import { PaymentModel } from "../api/models/payment.model.js";
import {
  UserModel,
  type SubscriptionStatus,
  type SubscriptionType,
} from "../api/models/user.model.js";

export const HANDLED_RAZORPAY_EVENTS = [
  "subscription.activated",
  "subscription.charged",
  "subscription.authenticated",
  "subscription.updated",
  "subscription.pending",
  "subscription.halted",
  "subscription.paused",
  "subscription.resumed",
  "subscription.cancelled",
  "subscription.completed",
  "subscription.expired",
  "payment.captured",
  "payment.failed",
] as const;

export type HandledRazorpayEvent = (typeof HANDLED_RAZORPAY_EVENTS)[number];

export const isHandledRazorpayEvent = (
  candidate: string,
): candidate is HandledRazorpayEvent =>
  (HANDLED_RAZORPAY_EVENTS as ReadonlyArray<string>).includes(candidate);

type RazorpaySubscriptionEventEntity = {
  id?: string;
  status?: string;
  current_start?: number | null;
  current_end?: number | null;
  charge_at?: number | null;
  start_at?: number | null;
  end_at?: number | null;
  ended_at?: number | null;
  paid_count?: number | null;
  total_count?: number | null;
  short_url?: string | null;
  customer_id?: string | null;
  plan_id?: string | null;
  notes?: Record<string, unknown> | null;
};

type RazorpayPaymentEventEntity = {
  id?: string;
  subscription_id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  method?: string;
  status?: string;
  error_code?: string | null;
  error_description?: string | null;
};

export type RazorpayLifecycleEventInput = {
  eventId: string;
  event: HandledRazorpayEvent;
  occurredAt: Date;
  subscription?: RazorpaySubscriptionEventEntity;
  payment?: RazorpayPaymentEventEntity;
};

const fromUnixSeconds = (
  unixSeconds: number | null | undefined,
): Date | null => {
  if (unixSeconds === null || unixSeconds === undefined) {
    return null;
  }
  return new Date(unixSeconds * 1000);
};

const isValidSubscriptionStatus = (
  candidate: string | null | undefined,
): candidate is SubscriptionStatus =>
  candidate === "created" ||
  candidate === "authenticated" ||
  candidate === "active" ||
  candidate === "pending" ||
  candidate === "halted" ||
  candidate === "paused" ||
  candidate === "cancelled" ||
  candidate === "completed" ||
  candidate === "expired";

const PRO_ACTIVE_STATUSES: ReadonlyArray<SubscriptionStatus> = [
  "active",
  "authenticated",
  "pending",
  "halted",
];

const computeUserPlanForStatus = (
  status: SubscriptionStatus,
): SubscriptionType => (PRO_ACTIVE_STATUSES.includes(status) ? "pro" : "free");

type SubscriptionUpdate = {
  status?: SubscriptionStatus;
  currentStart?: Date | null;
  currentEnd?: Date | null;
  chargeAt?: Date | null;
  startAt?: Date | null;
  endAt?: Date | null;
  cancelledAt?: Date | null;
  paidCount?: number;
  totalCount?: number;
  shortUrl?: string | null;
  razorpayCustomerId?: string;
};

const buildSubscriptionUpdateFromEntity = (
  entity: RazorpaySubscriptionEventEntity,
): SubscriptionUpdate => {
  const update: SubscriptionUpdate = {};

  if (isValidSubscriptionStatus(entity.status)) {
    update.status = entity.status;
  }
  const currentStart = fromUnixSeconds(entity.current_start);
  if (currentStart !== null) {
    update.currentStart = currentStart;
  }
  const currentEnd = fromUnixSeconds(entity.current_end);
  if (currentEnd !== null) {
    update.currentEnd = currentEnd;
  }
  const chargeAt = fromUnixSeconds(entity.charge_at);
  if (chargeAt !== null) {
    update.chargeAt = chargeAt;
  }
  const startAt = fromUnixSeconds(entity.start_at);
  if (startAt !== null) {
    update.startAt = startAt;
  }
  const endAt = fromUnixSeconds(entity.end_at ?? entity.ended_at);
  if (endAt !== null) {
    update.endAt = endAt;
  }
  if (typeof entity.paid_count === "number") {
    update.paidCount = entity.paid_count;
  }
  if (typeof entity.total_count === "number") {
    update.totalCount = entity.total_count;
  }
  if (entity.short_url) {
    update.shortUrl = entity.short_url;
  }
  if (entity.customer_id) {
    update.razorpayCustomerId = entity.customer_id;
  }

  return update;
};

const findSubscriptionForEvent = async (
  eventInput: RazorpayLifecycleEventInput,
): Promise<SubscriptionDocument | null> => {
  const subscriptionRazorpayId =
    eventInput.subscription?.id ?? eventInput.payment?.subscription_id ?? null;
  if (!subscriptionRazorpayId) {
    return null;
  }
  return SubscriptionModel.findOne({
    razorpaySubscriptionId: subscriptionRazorpayId,
  });
};

const resolvePaymentStatus = (
  eventName: HandledRazorpayEvent,
): "success" | "failed" | null => {
  if (eventName === "payment.captured") {
    return "success";
  }
  if (eventName === "payment.failed") {
    return "failed";
  }
  return null;
};

const resolvePaymentMethod = (
  method: string | undefined,
): "card" | "upi" | "netbanking" | "wallet" | "emi" | null => {
  if (!method) {
    return null;
  }

  const normalizedMethod = method.trim().toLowerCase();
  if (
    normalizedMethod === "card" ||
    normalizedMethod === "upi" ||
    normalizedMethod === "netbanking" ||
    normalizedMethod === "wallet" ||
    normalizedMethod === "emi"
  ) {
    return normalizedMethod;
  }
  return null;
};

const upsertPaymentFromEvent = async (
  eventInput: RazorpayLifecycleEventInput,
  subscriptionDocument: SubscriptionDocument,
): Promise<void> => {
  const paymentStatus = resolvePaymentStatus(eventInput.event);
  const paymentEntity = eventInput.payment;
  if (!paymentStatus || !paymentEntity?.id) {
    return;
  }

  const errorCode = paymentEntity.error_code?.trim();
  const errorDescription = paymentEntity.error_description?.trim();
  const failureReason =
    paymentStatus === "failed"
      ? [errorCode, errorDescription].filter(Boolean).join(": ") || "Payment failed"
      : null;

  await PaymentModel.updateOne(
    { razorpayPaymentId: paymentEntity.id },
    {
      $setOnInsert: {
        userId: subscriptionDocument.userId,
        subscriptionId: subscriptionDocument._id,
        razorpayPaymentId: paymentEntity.id,
        razorpayOrderId: paymentEntity.order_id ?? null,
        amount: Math.max(0, Math.round((paymentEntity.amount ?? 0) / 100)),
        currency: (paymentEntity.currency ?? "INR").toUpperCase(),
        status: paymentStatus,
        method: resolvePaymentMethod(paymentEntity.method),
        failureReason,
      },
    },
    { upsert: true },
  );
};

const applySubscriptionUpdateAtomically = async (
  subscriptionDocument: SubscriptionDocument,
  update: SubscriptionUpdate,
  eventInput: RazorpayLifecycleEventInput,
): Promise<SubscriptionDocument | null> => {
  const persistedLastEventAt = subscriptionDocument.lastEventAt ?? null;
  if (
    persistedLastEventAt &&
    persistedLastEventAt.getTime() > eventInput.occurredAt.getTime()
  ) {
    return subscriptionDocument;
  }

  const filter: {
    _id: SubscriptionDocument["_id"];
    lastEventId?: { $ne: string };
  } = { _id: subscriptionDocument._id };

  if (subscriptionDocument.lastEventId !== eventInput.eventId) {
    filter.lastEventId = { $ne: eventInput.eventId };
  }

  return SubscriptionModel.findOneAndUpdate(
    filter,
    {
      $set: {
        ...update,
        lastEventId: eventInput.eventId,
        lastEventAt: eventInput.occurredAt,
      },
    },
    { new: true },
  );
};

const syncUserFromSubscription = async (
  subscriptionDocument: SubscriptionDocument,
): Promise<void> => {
  if (!isValidSubscriptionStatus(subscriptionDocument.status)) {
    return;
  }

  const resolvedPlan = computeUserPlanForStatus(subscriptionDocument.status);
  const setUpdate: Record<string, unknown> = {
    subscriptionStatus: subscriptionDocument.status,
    razorpaySubscriptionId: subscriptionDocument.razorpaySubscriptionId,
    razorpayCustomerId: subscriptionDocument.razorpayCustomerId,
    subscription: resolvedPlan,
  };

  if (subscriptionDocument.currentStart) {
    setUpdate.subscriptionStartDate = subscriptionDocument.currentStart;
  }
  if (subscriptionDocument.currentEnd) {
    setUpdate.subscriptionEndDate = subscriptionDocument.currentEnd;
  }
  setUpdate.isSubscriptionActive = resolvedPlan === "pro";

  await UserModel.updateOne(
    { _id: subscriptionDocument.userId },
    { $set: setUpdate },
  );
};

export type ProcessLifecycleEventResult =
  | { kind: "applied"; subscriptionId: string; status: SubscriptionStatus }
  | { kind: "skipped"; reason: string };

export const processRazorpayLifecycleEvent = async (
  eventInput: RazorpayLifecycleEventInput,
): Promise<ProcessLifecycleEventResult> => {
  const subscriptionDocument = await findSubscriptionForEvent(eventInput);
  if (!subscriptionDocument) {
    return {
      kind: "skipped",
      reason: "subscription_not_found",
    };
  }

  if (
    subscriptionDocument.lastEventId &&
    subscriptionDocument.lastEventId === eventInput.eventId
  ) {
    return {
      kind: "skipped",
      reason: "duplicate_event",
    };
  }

  let subscriptionUpdate: SubscriptionUpdate = {};
  if (eventInput.subscription) {
    subscriptionUpdate = buildSubscriptionUpdateFromEntity(
      eventInput.subscription,
    );
  }

  switch (eventInput.event) {
    case "subscription.activated":
      subscriptionUpdate.status = "active";
      break;
    case "subscription.charged":
      subscriptionUpdate.status = subscriptionUpdate.status ?? "active";
      if (typeof eventInput.subscription?.paid_count === "number") {
        subscriptionUpdate.paidCount = eventInput.subscription.paid_count;
      }
      break;
    case "subscription.authenticated":
      subscriptionUpdate.status = "authenticated";
      break;
    case "subscription.pending":
      subscriptionUpdate.status = "pending";
      break;
    case "subscription.halted":
      subscriptionUpdate.status = "halted";
      break;
    case "subscription.paused":
      subscriptionUpdate.status = "paused";
      break;
    case "subscription.resumed":
      subscriptionUpdate.status = subscriptionUpdate.status ?? "active";
      break;
    case "subscription.cancelled":
      subscriptionUpdate.status = "cancelled";
      subscriptionUpdate.cancelledAt =
        subscriptionUpdate.cancelledAt ?? eventInput.occurredAt;
      break;
    case "subscription.completed":
      subscriptionUpdate.status = "completed";
      break;
    case "subscription.expired":
      subscriptionUpdate.status = "expired";
      break;
    case "payment.captured":
      subscriptionUpdate.status = subscriptionUpdate.status ?? "active";
      break;
    case "subscription.updated":
      break;
    case "payment.failed":
      subscriptionUpdate.status = subscriptionUpdate.status ?? "halted";
      break;
    default:
      break;
  }

  const updatedSubscription = await applySubscriptionUpdateAtomically(
    subscriptionDocument,
    subscriptionUpdate,
    eventInput,
  );

  if (!updatedSubscription) {
    return { kind: "skipped", reason: "concurrent_update" };
  }

  await upsertPaymentFromEvent(eventInput, updatedSubscription);
  await syncUserFromSubscription(updatedSubscription);

  return {
    kind: "applied",
    subscriptionId: updatedSubscription.razorpaySubscriptionId,
    status: updatedSubscription.status as SubscriptionStatus,
  };
};
