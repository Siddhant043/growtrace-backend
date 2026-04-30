import type { NextFunction, Request, Response } from "express";

import type { SubscriptionType } from "../models/user.model";
import {
  getEffectivePlanForUser,
  type EffectivePlanInfo,
} from "../../services/planInfo.service";
import type { AuthenticatedRequest } from "./authenticate";

type ApiError = Error & {
  statusCode: number;
  code?: string;
  details?: Record<string, unknown>;
};

const buildUpgradeRequiredError = (requiredPlan: SubscriptionType): ApiError => {
  const upgradeError = new Error(
    "PRO plan required to access this feature",
  ) as ApiError;
  upgradeError.statusCode = 402;
  upgradeError.code = "UPGRADE_REQUIRED";
  upgradeError.details = { requiredPlan };
  return upgradeError;
};

const buildAuthRequiredError = (): ApiError => {
  const authError = new Error("Authentication required") as ApiError;
  authError.statusCode = 401;
  return authError;
};

export type AuthenticatedRequestWithPlan = AuthenticatedRequest & {
  userPlan: EffectivePlanInfo;
};

export const requirePlan = (minimumPlan: SubscriptionType) => {
  return async (
    request: Request,
    _response: Response,
    next: NextFunction,
  ): Promise<void> => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const userId = authenticatedRequest.authenticatedUser?.id;
    if (!userId) {
      next(buildAuthRequiredError());
      return;
    }

    try {
      const planInfo = await getEffectivePlanForUser(userId);
      if (minimumPlan === "pro" && planInfo.plan !== "pro") {
        next(buildUpgradeRequiredError(minimumPlan));
        return;
      }
      (request as AuthenticatedRequestWithPlan).userPlan = planInfo;
      next();
    } catch (error) {
      next(error as Error);
    }
  };
};
