import { Types } from "mongoose";

import type { SubscriptionDocument } from "../api/models/subscription.model.js";
import { SubscriptionModel } from "../api/models/subscription.model.js";
import { UserModel } from "../api/models/user.model.js";
import { fetchRazorpaySubscription } from "../infrastructure/razorpay.js";

const PENDING_SUBSCRIPTION_REUSE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const REUSABLE_PENDING_SUBSCRIPTION_STATUSES = ["created"] as const;

export const backfillUserRazorpayCustomerId = async (
  userId: Types.ObjectId,
  existingCustomerId: string | null | undefined,
): Promise<string | null> => {
  if (existingCustomerId) {
    return existingCustomerId;
  }

  const latestSubscriptionWithCustomer = await SubscriptionModel.findOne({
    userId,
    razorpayCustomerId: { $exists: true, $ne: null },
  })
    .sort({ createdAt: -1 })
    .select({ razorpayCustomerId: 1 })
    .lean();

  const customerIdFromSubscription =
    latestSubscriptionWithCustomer?.razorpayCustomerId ?? null;

  if (!customerIdFromSubscription) {
    return null;
  }

  await UserModel.updateOne(
    { _id: userId },
    { $set: { razorpayCustomerId: customerIdFromSubscription } },
  );

  return customerIdFromSubscription;
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
