import { Types } from "mongoose";

import { env } from "../config/env.js";
import {
  SubscriptionModel,
  type SubscriptionBillingInterval,
  type SubscriptionDocument,
} from "../api/models/subscription.model.js";
import {
  UserModel,
  type SubscriptionStatus,
  type SubscriptionType,
} from "../api/models/user.model.js";
import {
  getPlanFeatures,
  type PlanFeature,
} from "./plan/planFeatures.js";
import { isEligibleForFirstMonthFree } from "./firstMonthFreePromo.service.js";
import {
  resolveBillingRegionFromCountryCode,
  resolveCurrencyForBillingRegion,
  type BillingCurrency,
  type BillingRegion,
} from "./billingRegion.service.js";

export type EffectivePlanInfo = {
  plan: SubscriptionType;
  status: SubscriptionStatus | null;
  features: ReadonlyArray<PlanFeature>;
  currentPeriodEnd: Date | null;
  cancelAtCycleEnd: boolean;
  lifetime: boolean;
  manage: { shortUrl: string } | null;
  firstMonthFreeEligible: boolean;
  firstMonthFreeTrialEndsAt: Date | null;
  billingInterval: SubscriptionBillingInterval | null;
  countryCode: string | null;
  billingRegion: BillingRegion | null;
  currency: BillingCurrency | null;
  requiresCountry: boolean;
};

const PRO_ACTIVE_GRACE_STATUSES: ReadonlyArray<SubscriptionStatus> = [
  "active",
  "authenticated",
  "pending",
  "halted",
];

const computeEffectivePeriodEnd = (
  subscriptionEndDate: Date | null,
): Date | null => {
  if (!subscriptionEndDate) {
    return null;
  }
  const graceWindowMs = env.BILLING_GRACE_PERIOD_HOURS * 60 * 60 * 1000;
  return new Date(subscriptionEndDate.getTime() + graceWindowMs);
};

const isPlanStillEffective = (
  status: SubscriptionStatus | null,
  effectivePeriodEnd: Date | null,
  currentDate: Date,
): boolean => {
  if (!status) {
    return false;
  }
  if (
    status === "cancelled" ||
    status === "completed" ||
    status === "expired"
  ) {
    return effectivePeriodEnd !== null && currentDate <= effectivePeriodEnd;
  }
  if (PRO_ACTIVE_GRACE_STATUSES.includes(status)) {
    if (!effectivePeriodEnd) {
      return true;
    }
    return currentDate <= effectivePeriodEnd;
  }
  return false;
};

export const getEffectivePlanForUser = async (
  userId: string,
): Promise<EffectivePlanInfo> => {
  const userObjectId = new Types.ObjectId(userId);
  const userDocument = await UserModel.findById(userObjectId)
    .select(
      "subscription subscriptionStatus subscriptionStartDate subscriptionEndDate isLifetimeSubscription razorpaySubscriptionId countryCode",
    )
    .lean();

  const userCountryCode =
    typeof userDocument?.countryCode === "string" &&
    userDocument.countryCode.trim().length > 0
      ? userDocument.countryCode.trim().toUpperCase()
      : null;
  const billingRegion = resolveBillingRegionFromCountryCode(userCountryCode);
  const currency =
    billingRegion === null ? null : resolveCurrencyForBillingRegion(billingRegion);
  const requiresCountry = userCountryCode === null;

  if (!userDocument) {
    return {
      plan: "free",
      status: null,
      features: getPlanFeatures("free"),
      currentPeriodEnd: null,
      cancelAtCycleEnd: false,
      lifetime: false,
      manage: null,
      firstMonthFreeEligible: false,
      firstMonthFreeTrialEndsAt: null,
      billingInterval: null,
      countryCode: null,
      billingRegion: null,
      currency: null,
      requiresCountry: true,
    };
  }

  const isLifetime = userDocument.isLifetimeSubscription === true;
  if (isLifetime) {
    return {
      plan: "pro",
      status: "active",
      features: getPlanFeatures("pro"),
      currentPeriodEnd: null,
      cancelAtCycleEnd: false,
      lifetime: true,
      manage: null,
      firstMonthFreeEligible: false,
      firstMonthFreeTrialEndsAt: null,
      billingInterval: null,
      countryCode: userCountryCode,
      billingRegion,
      currency,
      requiresCountry,
    };
  }

  let activeSubscription: SubscriptionDocument | null = null;
  if (userDocument.razorpaySubscriptionId) {
    activeSubscription = await SubscriptionModel.findOne({
      razorpaySubscriptionId: userDocument.razorpaySubscriptionId,
    }).lean();
  }
  if (!activeSubscription) {
    activeSubscription = await SubscriptionModel.findOne({
      userId: userObjectId,
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  const persistedStatus =
    (userDocument.subscriptionStatus as SubscriptionStatus | null | undefined) ??
    null;
  const periodEnd =
    activeSubscription?.currentEnd ??
    userDocument.subscriptionEndDate ??
    null;
  const effectivePeriodEnd = computeEffectivePeriodEnd(periodEnd);

  const currentDate = new Date();
  const planEffective = isPlanStillEffective(
    persistedStatus,
    effectivePeriodEnd,
    currentDate,
  );

  const resolvedPlan: SubscriptionType =
    userDocument.subscription === "pro" && planEffective ? "pro" : "free";

  const manage =
    activeSubscription && activeSubscription.shortUrl
      ? { shortUrl: activeSubscription.shortUrl }
      : null;

  const firstMonthFreeEligible = await isEligibleForFirstMonthFree(userId);
  const firstMonthFreeTrialEndsAt =
    activeSubscription?.promoType === "first_month_free"
      ? (activeSubscription.promoTrialEndsAt ??
        activeSubscription.chargeAt ??
        activeSubscription.startAt ??
        null)
      : null;

  return {
    plan: resolvedPlan,
    status: persistedStatus,
    features: getPlanFeatures(resolvedPlan),
    currentPeriodEnd: periodEnd,
    cancelAtCycleEnd: activeSubscription?.cancelAtCycleEnd === true,
    lifetime: false,
    manage,
    firstMonthFreeEligible,
    firstMonthFreeTrialEndsAt,
    billingInterval: activeSubscription?.billingInterval ?? null,
    countryCode: userCountryCode,
    billingRegion,
    currency,
    requiresCountry,
  };
};
