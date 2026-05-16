import type { Request, Response } from "express";
import { Types } from "mongoose";

import { env } from "../../config/env.js";
import {
  cancelRazorpaySubscription,
  createProSubscription,
} from "../../infrastructure/razorpay.js";
import {
  FIRST_MONTH_FREE_PROMO_TYPE,
  resolveFirstMonthFreePromoForCheckout,
} from "../../services/firstMonthFreePromo.service.js";
import {
  ensureRazorpayCustomerForCheckout,
  findReusablePendingSubscription,
} from "../../services/subscriptionCheckout.service.js";
import { SubscriptionModel } from "../models/subscription.model.js";
import { UserModel } from "../models/user.model.js";
import type { AuthenticatedRequest } from "../middlewares/authenticate.js";
import type {
  CancelSubscriptionRequestBody,
  CreateSubscriptionRequestBody,
  SubscriptionPlanTier,
} from "../validators/payments.validator.js";

type ApiError = Error & {
  statusCode: number;
  code?: string;
  details?: Record<string, unknown>;
};

const createApiError = (
  message: string,
  statusCode: number,
  options?: { code?: string; details?: Record<string, unknown> },
): ApiError => {
  const apiError = new Error(message) as ApiError;
  apiError.statusCode = statusCode;
  if (options?.code) {
    apiError.code = options.code;
  }
  if (options?.details) {
    apiError.details = options.details;
  }
  return apiError;
};

const PRO_BILLING_TOTAL_COUNT_BY_TIER: Record<SubscriptionPlanTier, number> = {
  monthly: 12,
  yearly: 1,
};

const ACTIVE_SUBSCRIPTION_STATUSES = [
  "authenticated",
  "active",
  "pending",
  "halted",
] as const;

const CANCELLABLE_SUBSCRIPTION_STATUSES = [
  ...ACTIVE_SUBSCRIPTION_STATUSES,
  "created",
] as const;

const resolvePlanIdForTier = (planTier: SubscriptionPlanTier): string => {
  if (planTier === "monthly") {
    return env.RAZORPAY_PRO_MONTHLY_PLAN_ID;
  }
  if (planTier === "yearly") {
    return env.RAZORPAY_PRO_YEARLY_PLAN_ID;
  }
  throw createApiError("Unsupported plan tier", 400, {
    code: "UNSUPPORTED_PLAN_TIER",
  });
};

const resolveTotalCountForTier = (planTier: SubscriptionPlanTier): number =>
  PRO_BILLING_TOTAL_COUNT_BY_TIER[planTier];

const fromUnixSeconds = (unixSeconds: number | null): Date | null =>
  unixSeconds === null ? null : new Date(unixSeconds * 1000);

type CreateSubscriptionResponsePayload = {
  subscriptionId: string;
  shortUrl: string;
  keyId: string;
  status: string;
  prefill: {
    name: string;
    email: string;
  };
  promo: {
    firstMonthFreeApplied: boolean;
    trialEndsAt: string | null;
  };
  reusedPendingCheckout: boolean;
};

const buildCreateSubscriptionResponse = (parameters: {
  subscriptionId: string;
  shortUrl: string;
  status: string;
  userFullName: string;
  userEmail: string;
  firstMonthFreeApplied: boolean;
  trialEndsAt: Date | null;
  reusedPendingCheckout: boolean;
}): CreateSubscriptionResponsePayload => ({
  subscriptionId: parameters.subscriptionId,
  shortUrl: parameters.shortUrl,
  keyId: env.RAZORPAY_KEY_ID,
  status: parameters.status,
  prefill: {
    name: parameters.userFullName,
    email: parameters.userEmail,
  },
  promo: {
    firstMonthFreeApplied: parameters.firstMonthFreeApplied,
    trialEndsAt: parameters.trialEndsAt?.toISOString() ?? null,
  },
  reusedPendingCheckout: parameters.reusedPendingCheckout,
});

export const createSubscriptionForCurrentUser = async (
  request: Request<unknown, unknown, CreateSubscriptionRequestBody>,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = request as AuthenticatedRequest;
  const userId = authenticatedRequest.authenticatedUser.id;
  const { planTier } = request.body;

  const userDocument = await UserModel.findById(userId);
  if (!userDocument || userDocument.isDeleted) {
    throw createApiError("User not found", 404);
  }

  const existingActiveSubscription = await SubscriptionModel.findOne({
    userId: userDocument._id,
    status: { $in: ACTIVE_SUBSCRIPTION_STATUSES },
  });

  if (existingActiveSubscription) {
    throw createApiError(
      "An active subscription already exists for this user",
      409,
      {
        code: "SUBSCRIPTION_ALREADY_ACTIVE",
        details: {
          subscriptionId: existingActiveSubscription.razorpaySubscriptionId,
          shortUrl: existingActiveSubscription.shortUrl,
        },
      },
    );
  }

  const planId = resolvePlanIdForTier(planTier as SubscriptionPlanTier);

  const reusablePendingSubscription = await findReusablePendingSubscription(
    userDocument._id,
    planId,
  );

  if (reusablePendingSubscription) {
    const customerSummary = await ensureRazorpayCustomerForCheckout({
      _id: userDocument._id,
      email: userDocument.email,
      fullName: userDocument.fullName,
      razorpayCustomerId:
        userDocument.razorpayCustomerId ??
        reusablePendingSubscription.razorpayCustomerId,
      razorpaySubscriptionId: reusablePendingSubscription.razorpaySubscriptionId,
    });

    await UserModel.updateOne(
      { _id: userDocument._id },
      {
        $set: {
          razorpayCustomerId: customerSummary.id,
          razorpaySubscriptionId:
            reusablePendingSubscription.razorpaySubscriptionId,
          subscriptionStatus: reusablePendingSubscription.status,
        },
      },
    );

    response.status(201).json({
      success: true,
      data: buildCreateSubscriptionResponse({
        subscriptionId: reusablePendingSubscription.razorpaySubscriptionId,
        shortUrl: reusablePendingSubscription.shortUrl as string,
        status: reusablePendingSubscription.status,
        userFullName: userDocument.fullName,
        userEmail: userDocument.email,
        firstMonthFreeApplied:
          reusablePendingSubscription.promoType === FIRST_MONTH_FREE_PROMO_TYPE,
        trialEndsAt: reusablePendingSubscription.promoTrialEndsAt ?? null,
        reusedPendingCheckout: true,
      }),
    });
    return;
  }

  const customerSummary = await ensureRazorpayCustomerForCheckout({
    _id: userDocument._id,
    email: userDocument.email,
    fullName: userDocument.fullName,
    razorpayCustomerId: userDocument.razorpayCustomerId,
    razorpaySubscriptionId: userDocument.razorpaySubscriptionId,
  });

  const firstMonthFreePromo = await resolveFirstMonthFreePromoForCheckout(
    userDocument._id.toString(),
  );

  const createdSubscription = await createProSubscription({
    planId,
    totalCount: resolveTotalCountForTier(planTier as SubscriptionPlanTier),
    startAtUnix: firstMonthFreePromo.startAtUnix ?? undefined,
    notes: {
      internalUserId: userDocument._id.toString(),
      planTier,
      ...(firstMonthFreePromo.applyPromo
        ? { promo: FIRST_MONTH_FREE_PROMO_TYPE }
        : {}),
    },
  });

  const resolvedTrialEndsAt =
    fromUnixSeconds(createdSubscription.startAt) ??
    firstMonthFreePromo.trialEndsAt;

  const resolvedRazorpayCustomerId =
    createdSubscription.customerId ?? customerSummary.id;

  await SubscriptionModel.create({
    userId: userDocument._id,
    plan: "pro",
    billingInterval: planTier,
    status: createdSubscription.status,
    razorpaySubscriptionId: createdSubscription.id,
    razorpayPlanId: createdSubscription.planId,
    razorpayCustomerId: resolvedRazorpayCustomerId,
    currentStart: fromUnixSeconds(createdSubscription.currentStart),
    currentEnd: fromUnixSeconds(createdSubscription.currentEnd),
    chargeAt: fromUnixSeconds(createdSubscription.chargeAt),
    startAt: fromUnixSeconds(createdSubscription.startAt),
    endAt: fromUnixSeconds(createdSubscription.endAt),
    paidCount: createdSubscription.paidCount,
    totalCount: createdSubscription.totalCount,
    shortUrl: createdSubscription.shortUrl,
    promoType: firstMonthFreePromo.applyPromo
      ? FIRST_MONTH_FREE_PROMO_TYPE
      : null,
    promoTrialEndsAt: firstMonthFreePromo.applyPromo
      ? resolvedTrialEndsAt
      : null,
  });

  await UserModel.updateOne(
    { _id: userDocument._id },
    {
      $set: {
        razorpayCustomerId: resolvedRazorpayCustomerId,
        razorpaySubscriptionId: createdSubscription.id,
        subscriptionStatus: createdSubscription.status,
      },
    },
  );

  response.status(201).json({
    success: true,
    data: buildCreateSubscriptionResponse({
      subscriptionId: createdSubscription.id,
      shortUrl: createdSubscription.shortUrl,
      status: createdSubscription.status,
      userFullName: userDocument.fullName,
      userEmail: userDocument.email,
      firstMonthFreeApplied: firstMonthFreePromo.applyPromo,
      trialEndsAt: firstMonthFreePromo.applyPromo ? resolvedTrialEndsAt : null,
      reusedPendingCheckout: false,
    }),
  });
};

export const cancelSubscriptionForCurrentUser = async (
  request: Request<unknown, unknown, CancelSubscriptionRequestBody>,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = request as AuthenticatedRequest;
  const userId = authenticatedRequest.authenticatedUser.id;
  const { cancelAtCycleEnd } = request.body;

  const subscriptionToCancel = await SubscriptionModel.findOne({
    userId: new Types.ObjectId(userId),
    status: { $in: CANCELLABLE_SUBSCRIPTION_STATUSES },
  }).sort({ createdAt: -1 });

  if (!subscriptionToCancel) {
    throw createApiError("No active subscription found", 404, {
      code: "NO_ACTIVE_SUBSCRIPTION",
    });
  }

  const isPendingCreatedCheckout = subscriptionToCancel.status === "created";
  const shouldCancelAtCycleEnd = isPendingCreatedCheckout
    ? false
    : (cancelAtCycleEnd ?? true);

  await cancelRazorpaySubscription(
    subscriptionToCancel.razorpaySubscriptionId,
    shouldCancelAtCycleEnd,
  );

  await SubscriptionModel.updateOne(
    { _id: subscriptionToCancel._id },
    {
      $set: {
        status: isPendingCreatedCheckout ? "cancelled" : subscriptionToCancel.status,
        cancelAtCycleEnd: shouldCancelAtCycleEnd,
        cancelledAt: new Date(),
      },
    },
  );

  if (isPendingCreatedCheckout) {
    await UserModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        $set: {
          razorpaySubscriptionId: null,
          subscriptionStatus: null,
        },
      },
    );
  }

  response.status(200).json({
    success: true,
    data: {
      subscriptionId: subscriptionToCancel.razorpaySubscriptionId,
      cancelAtCycleEnd: shouldCancelAtCycleEnd,
    },
  });
};

export const getSubscriptionPortalForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = request as AuthenticatedRequest;
  const userId = authenticatedRequest.authenticatedUser.id;

  const activeSubscription = await SubscriptionModel.findOne({
    userId: new Types.ObjectId(userId),
    status: { $in: ACTIVE_SUBSCRIPTION_STATUSES },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!activeSubscription || !activeSubscription.shortUrl) {
    throw createApiError("No subscription portal available", 404, {
      code: "NO_ACTIVE_SUBSCRIPTION",
    });
  }

  response.status(200).json({
    success: true,
    data: {
      shortUrl: activeSubscription.shortUrl,
      subscriptionId: activeSubscription.razorpaySubscriptionId,
      status: activeSubscription.status,
    },
  });
};
