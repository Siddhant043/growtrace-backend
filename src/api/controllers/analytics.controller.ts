import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/authenticate";
import {
  compareAnalyticsByPlatform,
  getClickTrends,
  getOverview,
  getPlatformStats,
  getTopLinks,
} from "../../services/analytics.service";
import {
  isSupportedTrendRange,
  type TrendRange,
} from "../../services/analytics.helpers";

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
