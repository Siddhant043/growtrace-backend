import type { Request, Response } from "express";

import {
  getAttributionSummary,
  getJourneyDetailForUserTrackingId,
  getRecentJourneys,
} from "../../services/attribution.read.service.js";
import type { AuthenticatedRequest } from "../middlewares/authenticate.js";
import type {
  GetAttributionJourneyDetailRequestParams,
  GetAttributionRecentJourneysRequestQuery,
} from "../validators/attribution.validator.js";

const requireAuthenticatedUserId = (request: Request): string => {
  const authenticatedUser = (request as AuthenticatedRequest).authenticatedUser;
  if (!authenticatedUser) {
    const authError = new Error("Not authenticated") as Error & {
      statusCode: number;
    };
    authError.statusCode = 401;
    throw authError;
  }
  return authenticatedUser.id;
};

export const getAttributionSummaryForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUserId = requireAuthenticatedUserId(request);

  const summary = await getAttributionSummary(authenticatedUserId);

  response.status(200).json({ success: true, data: summary });
};

export const getAttributionRecentJourneysForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUserId = requireAuthenticatedUserId(request);

  const validatedQuery = request.query as unknown as
    | GetAttributionRecentJourneysRequestQuery
    | undefined;

  const limitFromQuery = validatedQuery?.limit ?? 20;

  const recentJourneys = await getRecentJourneys({
    userId: authenticatedUserId,
    limit: limitFromQuery,
  });

  response.status(200).json({ success: true, data: recentJourneys });
};

export const getAttributionJourneyDetailForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUserId = requireAuthenticatedUserId(request);

  const validatedParams = request.params as unknown as
    | GetAttributionJourneyDetailRequestParams
    | undefined;
  const targetUserTrackingId = validatedParams?.userTrackingId ?? "";

  const journeyDetail = await getJourneyDetailForUserTrackingId({
    userId: authenticatedUserId,
    userTrackingId: targetUserTrackingId,
  });

  if (!journeyDetail) {
    response
      .status(404)
      .json({ success: false, message: "Journey not found" });
    return;
  }

  response.status(200).json({ success: true, data: journeyDetail });
};
