import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/authenticate";
import {
  getOverview,
  getPlatformStats,
  getTopLinks,
} from "../../services/analytics.service";

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
