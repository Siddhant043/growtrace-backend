import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/authenticate.js";
import type { LinkPlatform } from "../models/link.model.js";
import {
  compareAnalyticsByPlatform,
  getClickTrends,
  getOverview,
  getPlatformStats,
  getTopLinks,
} from "../../services/analytics.service.js";
import {
  isSupportedTrendRange,
  type TrendRange,
} from "../../utils/analytics.helpers.js";
import {
  getContentPerformanceForRange,
  getEngagementTrendsForRange,
  getPlatformQualityComparison,
} from "../../services/advancedAnalytics.service.js";
import {
  resolveDayCountForTrendRange,
  type AnalyticsTrendRange,
  type ContentPerformanceRequestQuery,
  type EngagementTrendsRequestQuery,
  type PlatformQualityRequestQuery,
} from "../validators/analytics.validator.js";
import { resolveDateRange } from "../../utils/dateRange.utils.js";

const getAuthenticatedRequest = (request: Request): AuthenticatedRequest =>
  request as AuthenticatedRequest;

export const getAnalyticsOverview = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const overview = await getOverview(authenticatedRequest.authenticatedUser.id);

  response.status(200).json({
    success: true,
    data: overview,
  });
};

export const getAnalyticsPlatformStats = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const platformStats = await getPlatformStats(authenticatedRequest.authenticatedUser.id);

  response.status(200).json({
    success: true,
    data: platformStats,
  });
};

export const getAnalyticsTopLinks = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const topLinks = await getTopLinks(authenticatedRequest.authenticatedUser.id);

  response.status(200).json({
    success: true,
    data: topLinks,
  });
};

type ApiError = Error & { statusCode: number };

const createApiError = (message: string, statusCode: number): ApiError => {
  const apiError = new Error(message) as ApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

export const getAnalyticsTrends = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const requestedRange = String(request.query.range ?? "7d");

  if (!isSupportedTrendRange(requestedRange)) {
    throw createApiError("range must be one of: 7d, 30d", 400);
  }

  const trends = await getClickTrends(
    authenticatedRequest.authenticatedUser.id,
    requestedRange as TrendRange,
  );

  response.status(200).json({
    success: true,
    data: trends,
  });
};

export const getAnalyticsComparison = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const requestedDimension = String(request.query.dimension ?? "platform");

  if (requestedDimension !== "platform") {
    throw createApiError("dimension must be: platform", 400);
  }

  const comparisonData = await compareAnalyticsByPlatform(
    authenticatedRequest.authenticatedUser.id,
  );

  response.status(200).json({
    success: true,
    data: comparisonData,
  });
};

const buildAdvancedAnalyticsDateRange = (
  trendRange: AnalyticsTrendRange,
  fromDate?: string,
  toDate?: string,
) => {
  const dayCountForTrendRange = resolveDayCountForTrendRange(trendRange);
  return resolveDateRange(
    { fromDate, toDate },
    dayCountForTrendRange,
  );
};

export const getEngagementTrends = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const validatedQuery = request.query as unknown as EngagementTrendsRequestQuery;

  const resolvedRange = buildAdvancedAnalyticsDateRange(
    validatedQuery.range,
    validatedQuery.from,
    validatedQuery.to,
  );

  const engagementTrends = await getEngagementTrendsForRange(
    authenticatedRequest.authenticatedUser.id,
    resolvedRange,
    {
      platform: validatedQuery.platform as LinkPlatform | undefined,
      campaign: validatedQuery.campaign,
    },
  );

  response.status(200).json({
    success: true,
    data: engagementTrends,
  });
};

export const getPlatformQuality = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const validatedQuery = request.query as unknown as PlatformQualityRequestQuery;

  const resolvedRange = buildAdvancedAnalyticsDateRange(
    validatedQuery.range,
    validatedQuery.from,
    validatedQuery.to,
  );

  const platformQuality = await getPlatformQualityComparison(
    authenticatedRequest.authenticatedUser.id,
    resolvedRange,
  );

  response.status(200).json({
    success: true,
    data: platformQuality,
  });
};

export const getContentPerformance = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const validatedQuery = request.query as unknown as ContentPerformanceRequestQuery;

  const resolvedRange = buildAdvancedAnalyticsDateRange(
    validatedQuery.range,
    validatedQuery.from,
    validatedQuery.to,
  );

  const contentPerformance = await getContentPerformanceForRange(
    authenticatedRequest.authenticatedUser.id,
    resolvedRange,
    {
      platform: validatedQuery.platform as LinkPlatform | undefined,
      campaign: validatedQuery.campaign,
      limit: validatedQuery.limit,
    },
  );

  response.status(200).json({
    success: true,
    data: contentPerformance,
  });
};
