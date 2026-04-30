import type { Request, Response } from "express";

import {
  getAudienceEngagementHistogram,
  getAudienceSegmentCounts,
  getCohortMetrics,
  listAudienceInsights,
  listUsersAggregated,
  type AudienceUserSegmentFilter,
  type AudienceUserSortField,
} from "../../services/audience.read.service";
import type { AuthenticatedRequest } from "../middlewares/authenticate";
import type {
  GetAudienceCohortsRequestQuery,
  GetAudienceInsightsRequestQuery,
  GetAudienceUsersRequestQuery,
} from "../validators/audience.validator";

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

export const getAudienceSegmentsForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUserId = requireAuthenticatedUserId(request);
  const segmentSummary = await getAudienceSegmentCounts(authenticatedUserId);

  response.status(200).json({ success: true, data: segmentSummary });
};

export const getAudienceCohortsForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUserId = requireAuthenticatedUserId(request);
  const validatedQuery = request.query as unknown as
    | GetAudienceCohortsRequestQuery
    | undefined;

  const cohortRows = await getCohortMetrics({
    userId: authenticatedUserId,
    fromCohortDate: validatedQuery?.from,
    toCohortDate: validatedQuery?.to,
    primaryPlatform: validatedQuery?.platform,
    limit: validatedQuery?.limit ?? 200,
  });

  response.status(200).json({ success: true, data: cohortRows });
};

export const getAudienceUsersForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUserId = requireAuthenticatedUserId(request);
  const validatedQuery = request.query as unknown as
    | GetAudienceUsersRequestQuery
    | undefined;

  const result = await listUsersAggregated({
    userId: authenticatedUserId,
    page: validatedQuery?.page ?? 1,
    pageSize: validatedQuery?.pageSize ?? 25,
    segment: (validatedQuery?.segment ?? "all") as AudienceUserSegmentFilter,
    primaryPlatform: validatedQuery?.platform,
    sortBy: (validatedQuery?.sortBy ?? "engagementScore") as AudienceUserSortField,
  });

  response.status(200).json({ success: true, data: result });
};

export const getAudienceInsightsForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUserId = requireAuthenticatedUserId(request);
  const validatedQuery = request.query as unknown as
    | GetAudienceInsightsRequestQuery
    | undefined;

  const insightRows = await listAudienceInsights({
    userId: authenticatedUserId,
    limit: validatedQuery?.limit ?? 10,
  });

  response.status(200).json({ success: true, data: insightRows });
};

export const getAudienceEngagementHistogramForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUserId = requireAuthenticatedUserId(request);
  const histogramBins = await getAudienceEngagementHistogram(
    authenticatedUserId,
  );

  response.status(200).json({ success: true, data: histogramBins });
};
