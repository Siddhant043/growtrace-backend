import { Types } from "mongoose";

import { SubscriptionModel } from "../api/models/subscription.model.js";
import { UserModel } from "../api/models/user.model.js";
import { env } from "../config/env.js";
import type { SubscriptionStatus } from "../api/models/user.model.js";

export const FIRST_MONTH_FREE_PROMO_TYPE = "first_month_free" as const;
export type FirstMonthFreePromoType = typeof FIRST_MONTH_FREE_PROMO_TYPE;

const PRIOR_PAID_SUBSCRIPTION_STATUSES: ReadonlyArray<SubscriptionStatus> = [
  "active",
  "cancelled",
  "completed",
  "expired",
];

const RAZORPAY_START_AT_LEAD_TIME_SECONDS = 5 * 60;

export const computeTrialStartAtUnix = (
  trialDays: number = env.PRO_FIRST_MONTH_FREE_DAYS,
  referenceDate: Date = new Date(),
): number => {
  const trialStartDate = new Date(referenceDate);
  trialStartDate.setUTCDate(trialStartDate.getUTCDate() + trialDays);
  const trialStartUnix = Math.floor(trialStartDate.getTime() / 1000);
  const minimumStartUnix =
    Math.floor(referenceDate.getTime() / 1000) + RAZORPAY_START_AT_LEAD_TIME_SECONDS;

  return Math.max(trialStartUnix, minimumStartUnix);
};

export const trialEndsAtFromStartAtUnix = (startAtUnix: number): Date =>
  new Date(startAtUnix * 1000);

const hasPriorPaidProSubscription = async (
  userObjectId: Types.ObjectId,
): Promise<boolean> => {
  const priorPaidSubscription = await SubscriptionModel.findOne({
    userId: userObjectId,
    $or: [
      { paidCount: { $gte: 1 } },
      { status: { $in: PRIOR_PAID_SUBSCRIPTION_STATUSES } },
    ],
  })
    .select({ _id: 1 })
    .lean();

  return priorPaidSubscription !== null;
};

export const isEligibleForFirstMonthFree = async (
  userId: string,
): Promise<boolean> => {
  if (!env.PRO_FIRST_MONTH_FREE_ENABLED) {
    return false;
  }

  const userObjectId = new Types.ObjectId(userId);
  const userDocument = await UserModel.findById(userObjectId)
    .select("isLifetimeSubscription isDeleted")
    .lean();

  if (!userDocument || userDocument.isDeleted) {
    return false;
  }

  if (userDocument.isLifetimeSubscription === true) {
    return false;
  }

  return !(await hasPriorPaidProSubscription(userObjectId));
};

export const resolveFirstMonthFreePromoForCheckout = async (
  userId: string,
): Promise<{
  applyPromo: boolean;
  startAtUnix: number | null;
  trialEndsAt: Date | null;
}> => {
  const eligible = await isEligibleForFirstMonthFree(userId);
  if (!eligible) {
    return {
      applyPromo: false,
      startAtUnix: null,
      trialEndsAt: null,
    };
  }

  const startAtUnix = computeTrialStartAtUnix();
  return {
    applyPromo: true,
    startAtUnix,
    trialEndsAt: trialEndsAtFromStartAtUnix(startAtUnix),
  };
};
