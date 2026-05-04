import type { Request, Response } from "express";
import { Types } from "mongoose";

import { env } from "../../config/env.js";
import {
  cancelRazorpaySubscription,
  createProSubscription,
  getOrCreateRazorpayCustomer,
} from "../../infrastructure/razorpay.js";
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

const PRO_BILLING_TOTAL_COUNT = 12;

const ACTIVE_SUBSCRIPTION_STATUSES = [
  "created",
  "authenticated",
  "active",
  "pending",
  "halted",
] as const;

const resolvePlanIdForTier = (planTier: SubscriptionPlanTier): string => {
  if (planTier === "monthly") {
    return env.RAZORPAY_PRO_MONTHLY_PLAN_ID;
  }
  throw createApiError("Unsupported plan tier", 400, {
    code: "UNSUPPORTED_PLAN_TIER",
  });
};

const fromUnixSeconds = (unixSeconds: number | null): Date | null =>
  unixSeconds === null ? null : new Date(unixSeconds * 1000);

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

  const customerSummary = await getOrCreateRazorpayCustomer({
    user: {
      _id: userDocument._id,
      email: userDocument.email,
      fullName: userDocument.fullName,
      razorpayCustomerId: userDocument.razorpayCustomerId,
    },
  });

  const planId = resolvePlanIdForTier(planTier as SubscriptionPlanTier);

  const createdSubscription = await createProSubscription({
    planId,
    totalCount: PRO_BILLING_TOTAL_COUNT,
    notes: {
      internalUserId: userDocument._id.toString(),
      planTier,
    },
  });

  await SubscriptionModel.create({
    userId: userDocument._id,
    plan: "pro",
    billingInterval: planTier,
    status: createdSubscription.status,
    razorpaySubscriptionId: createdSubscription.id,
    razorpayPlanId: createdSubscription.planId,
    razorpayCustomerId: customerSummary.id,
    currentStart: fromUnixSeconds(createdSubscription.currentStart),
    currentEnd: fromUnixSeconds(createdSubscription.currentEnd),
    chargeAt: fromUnixSeconds(createdSubscription.chargeAt),
    startAt: fromUnixSeconds(createdSubscription.startAt),
    endAt: fromUnixSeconds(createdSubscription.endAt),
    paidCount: createdSubscription.paidCount,
    totalCount: createdSubscription.totalCount,
    shortUrl: createdSubscription.shortUrl,
  });

  await UserModel.updateOne(
    { _id: userDocument._id },
    {
      $set: {
        razorpaySubscriptionId: createdSubscription.id,
        subscriptionStatus: createdSubscription.status,
      },
    },
  );

  response.status(201).json({
    success: true,
    data: {
      subscriptionId: createdSubscription.id,
      shortUrl: createdSubscription.shortUrl,
      keyId: env.RAZORPAY_KEY_ID,
      status: createdSubscription.status,
      prefill: {
        name: userDocument.fullName,
        email: userDocument.email,
      },
    },
  });
};

export const cancelSubscriptionForCurrentUser = async (
  request: Request<unknown, unknown, CancelSubscriptionRequestBody>,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = request as AuthenticatedRequest;
  const userId = authenticatedRequest.authenticatedUser.id;
  const { cancelAtCycleEnd } = request.body;

  const activeSubscription = await SubscriptionModel.findOne({
    userId: new Types.ObjectId(userId),
    status: { $in: ACTIVE_SUBSCRIPTION_STATUSES },
  });

  if (!activeSubscription) {
    throw createApiError("No active subscription found", 404, {
      code: "NO_ACTIVE_SUBSCRIPTION",
    });
  }

  await cancelRazorpaySubscription(
    activeSubscription.razorpaySubscriptionId,
    cancelAtCycleEnd ?? true,
  );

  await SubscriptionModel.updateOne(
    { _id: activeSubscription._id },
    {
      $set: {
        cancelAtCycleEnd: cancelAtCycleEnd ?? true,
        cancelledAt: new Date(),
      },
    },
  );

  response.status(200).json({
    success: true,
    data: {
      subscriptionId: activeSubscription.razorpaySubscriptionId,
      cancelAtCycleEnd: cancelAtCycleEnd ?? true,
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
