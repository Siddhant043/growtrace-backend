import Razorpay from "razorpay";
import type { Types } from "mongoose";

import { env } from "../config/env";
import { UserModel } from "../api/models/user.model";

let razorpaySingleton: Razorpay | null = null;

export const getRazorpayClient = (): Razorpay => {
  if (razorpaySingleton) {
    return razorpaySingleton;
  }

  razorpaySingleton = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });

  return razorpaySingleton;
};

const sanitizeContactNumber = (
  rawContact: string | null | undefined,
): string | undefined => {
  if (!rawContact) {
    return undefined;
  }
  const trimmedContact = rawContact.trim();
  if (trimmedContact.length === 0) {
    return undefined;
  }
  return trimmedContact;
};

export type RazorpayCustomerSummary = {
  id: string;
  email: string;
  name: string;
};

export type GetOrCreateRazorpayCustomerInput = {
  user: {
    _id: Types.ObjectId | string;
    email: string;
    fullName: string;
    razorpayCustomerId?: string | null;
    contact?: string | null;
  };
};

export const getOrCreateRazorpayCustomer = async (
  parameters: GetOrCreateRazorpayCustomerInput,
): Promise<RazorpayCustomerSummary> => {
  const razorpayClient = getRazorpayClient();
  const { user } = parameters;

  if (user.razorpayCustomerId) {
    return {
      id: user.razorpayCustomerId,
      email: user.email,
      name: user.fullName,
    };
  }

  const createdCustomer = await razorpayClient.customers.create({
    name: user.fullName,
    email: user.email,
    contact: sanitizeContactNumber(user.contact ?? null),
    fail_existing: 0,
    notes: { internalUserId: user._id.toString() },
  });

  await UserModel.updateOne(
    { _id: user._id },
    { $set: { razorpayCustomerId: createdCustomer.id } },
  );

  return {
    id: createdCustomer.id,
    email: createdCustomer.email ?? user.email,
    name: createdCustomer.name ?? user.fullName,
  };
};

export type CreateProSubscriptionInput = {
  planId: string;
  totalCount: number;
  customerNotify?: 0 | 1;
  notes?: Record<string, string>;
};

export type CreateProSubscriptionResult = {
  id: string;
  status: string;
  shortUrl: string;
  planId: string;
  totalCount: number;
  startAt: number | null;
  endAt: number | null;
  chargeAt: number | null;
  currentStart: number | null;
  currentEnd: number | null;
  customerId: string | null;
  paidCount: number;
};

export const createProSubscription = async (
  parameters: CreateProSubscriptionInput,
): Promise<CreateProSubscriptionResult> => {
  const razorpayClient = getRazorpayClient();

  const createdSubscription = await razorpayClient.subscriptions.create({
    plan_id: parameters.planId,
    total_count: parameters.totalCount,
    customer_notify: parameters.customerNotify ?? 1,
    notes: parameters.notes,
  });

  return {
    id: createdSubscription.id,
    status: createdSubscription.status,
    shortUrl: createdSubscription.short_url,
    planId: createdSubscription.plan_id,
    totalCount: createdSubscription.total_count,
    startAt: createdSubscription.start_at ?? null,
    endAt: createdSubscription.end_at ?? null,
    chargeAt: createdSubscription.charge_at ?? null,
    currentStart: createdSubscription.current_start ?? null,
    currentEnd: createdSubscription.current_end ?? null,
    customerId: createdSubscription.customer_id ?? null,
    paidCount: createdSubscription.paid_count ?? 0,
  };
};

export const cancelRazorpaySubscription = async (
  subscriptionId: string,
  cancelAtCycleEnd: boolean = true,
): Promise<{ id: string; status: string }> => {
  const razorpayClient = getRazorpayClient();
  const cancelledSubscription = await razorpayClient.subscriptions.cancel(
    subscriptionId,
    cancelAtCycleEnd,
  );
  return {
    id: cancelledSubscription.id,
    status: cancelledSubscription.status,
  };
};

export const fetchRazorpaySubscription = async (
  subscriptionId: string,
): Promise<CreateProSubscriptionResult> => {
  const razorpayClient = getRazorpayClient();
  const fetchedSubscription =
    await razorpayClient.subscriptions.fetch(subscriptionId);
  return {
    id: fetchedSubscription.id,
    status: fetchedSubscription.status,
    shortUrl: fetchedSubscription.short_url,
    planId: fetchedSubscription.plan_id,
    totalCount: fetchedSubscription.total_count,
    startAt: fetchedSubscription.start_at ?? null,
    endAt: fetchedSubscription.end_at ?? null,
    chargeAt: fetchedSubscription.charge_at ?? null,
    currentStart: fetchedSubscription.current_start ?? null,
    currentEnd: fetchedSubscription.current_end ?? null,
    customerId: fetchedSubscription.customer_id ?? null,
    paidCount: fetchedSubscription.paid_count ?? 0,
  };
};

export const verifyRazorpayWebhookSignature = (
  rawBody: string,
  signatureHeader: string,
): boolean => {
  if (!signatureHeader || !rawBody) {
    return false;
  }
  try {
    return Razorpay.validateWebhookSignature(
      rawBody,
      signatureHeader,
      env.RAZORPAY_WEBHOOK_SECRET,
    );
  } catch {
    return false;
  }
};
