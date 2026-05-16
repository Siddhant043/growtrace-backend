import { Types } from "mongoose";

import type { SubscriptionDocument } from "../api/models/subscription.model.js";
import { SubscriptionModel } from "../api/models/subscription.model.js";
import { UserModel } from "../api/models/user.model.js";
import {
  fetchRazorpaySubscription,
  getOrCreateRazorpayCustomer,
  type RazorpayCustomerSummary,
} from "../infrastructure/razorpay.js";

const PENDING_SUBSCRIPTION_REUSE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const REUSABLE_PENDING_SUBSCRIPTION_STATUSES = ["created"] as const;

const isNonEmptyCustomerId = (
  customerId: string | null | undefined,
): customerId is string =>
  typeof customerId === "string" && customerId.trim().length > 0;

export type ResolveRazorpayCustomerIdInput = {
  userId: Types.ObjectId;
  razorpayCustomerId: string | null | undefined;
  razorpaySubscriptionId: string | null | undefined;
};

const persistUserRazorpayCustomerId = async (
  userId: Types.ObjectId,
  customerId: string,
): Promise<void> => {
  await UserModel.updateOne(
    { _id: userId },
    { $set: { razorpayCustomerId: customerId } },
  );
};

export const resolveRazorpayCustomerIdForUser = async (
  input: ResolveRazorpayCustomerIdInput,
): Promise<string | null> => {
  if (isNonEmptyCustomerId(input.razorpayCustomerId)) {
    return input.razorpayCustomerId.trim();
  }

  const latestSubscriptionWithCustomer = await SubscriptionModel.findOne({
    userId: input.userId,
    razorpayCustomerId: { $exists: true, $ne: null },
  })
    .sort({ createdAt: -1 })
    .select({ razorpayCustomerId: 1 })
    .lean();

  if (isNonEmptyCustomerId(latestSubscriptionWithCustomer?.razorpayCustomerId)) {
    const customerIdFromSubscription =
      latestSubscriptionWithCustomer.razorpayCustomerId.trim();
    await persistUserRazorpayCustomerId(input.userId, customerIdFromSubscription);
    return customerIdFromSubscription;
  }

  if (isNonEmptyCustomerId(input.razorpaySubscriptionId)) {
    try {
      const razorpaySubscription = await fetchRazorpaySubscription(
        input.razorpaySubscriptionId.trim(),
      );
      if (isNonEmptyCustomerId(razorpaySubscription.customerId)) {
        const customerIdFromRazorpay = razorpaySubscription.customerId.trim();
        await persistUserRazorpayCustomerId(input.userId, customerIdFromRazorpay);
        return customerIdFromRazorpay;
      }
    } catch {
      // Subscription may be expired or invalid; continue to create path.
    }
  }

  return null;
};

/** @deprecated Use resolveRazorpayCustomerIdForUser */
export const backfillUserRazorpayCustomerId = async (
  userId: Types.ObjectId,
  existingCustomerId: string | null | undefined,
): Promise<string | null> =>
  resolveRazorpayCustomerIdForUser({
    userId,
    razorpayCustomerId: existingCustomerId,
    razorpaySubscriptionId: null,
  });

export type EnsureRazorpayCustomerForCheckoutInput = {
  _id: Types.ObjectId;
  email: string;
  fullName: string;
  razorpayCustomerId?: string | null;
  razorpaySubscriptionId?: string | null;
};

export const ensureRazorpayCustomerForCheckout = async (
  user: EnsureRazorpayCustomerForCheckoutInput,
): Promise<RazorpayCustomerSummary> => {
  const resolvedCustomerId = await resolveRazorpayCustomerIdForUser({
    userId: user._id,
    razorpayCustomerId: user.razorpayCustomerId,
    razorpaySubscriptionId: user.razorpaySubscriptionId,
  });

  return getOrCreateRazorpayCustomer({
    user: {
      _id: user._id,
      email: user.email,
      fullName: user.fullName,
      razorpayCustomerId: resolvedCustomerId,
    },
  });
};

export const findReusablePendingSubscription = async (
  userId: Types.ObjectId,
  razorpayPlanId: string,
): Promise<SubscriptionDocument | null> => {
  const reuseWindowStartedAt = new Date(
    Date.now() - PENDING_SUBSCRIPTION_REUSE_WINDOW_MS,
  );

  const pendingSubscription = await SubscriptionModel.findOne({
    userId,
    status: { $in: REUSABLE_PENDING_SUBSCRIPTION_STATUSES },
    razorpayPlanId,
    paidCount: 0,
    shortUrl: { $exists: true, $ne: null },
    createdAt: { $gte: reuseWindowStartedAt },
  })
    .sort({ createdAt: -1 });

  if (!pendingSubscription?.razorpaySubscriptionId || !pendingSubscription.shortUrl) {
    return null;
  }

  try {
    const razorpaySubscription = await fetchRazorpaySubscription(
      pendingSubscription.razorpaySubscriptionId,
    );

    if (razorpaySubscription.status !== "created") {
      await SubscriptionModel.updateOne(
        { _id: pendingSubscription._id },
        {
          $set: {
            status: razorpaySubscription.status,
            paidCount: razorpaySubscription.paidCount,
            currentStart: unixToDate(razorpaySubscription.currentStart),
            currentEnd: unixToDate(razorpaySubscription.currentEnd),
            chargeAt: unixToDate(razorpaySubscription.chargeAt),
            startAt: unixToDate(razorpaySubscription.startAt),
            endAt: unixToDate(razorpaySubscription.endAt),
          },
        },
      );
      return null;
    }

    return pendingSubscription;
  } catch {
    return null;
  }
};

const unixToDate = (unixSeconds: number | null): Date | null =>
  unixSeconds === null ? null : new Date(unixSeconds * 1000);
