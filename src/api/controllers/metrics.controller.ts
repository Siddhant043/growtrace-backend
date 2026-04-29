import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/authenticate";
import type { LinkPlatform } from "../models/link.model";
import {
  getCampaignMetricsForRange,
  getLinkMetricsForRange,
  getPlatformMetricsForRange,
  listLinkMetricsForRange,
} from "../../services/metrics.service";

const getAuthenticatedRequest = (request: Request): AuthenticatedRequest =>
  request as AuthenticatedRequest;

const buildDateRangeFromQuery = (
  request: Request,
): { fromDate?: string; toDate?: string } => {
  const fromValue =
    typeof request.query.from === "string" ? request.query.from : undefined;
  const toValue =
    typeof request.query.to === "string" ? request.query.to : undefined;

  return { fromDate: fromValue, toDate: toValue };
};

export const getLinkMetrics = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const linkIdParam = request.params.linkId as string;
  const dateRange = buildDateRangeFromQuery(request);

  const linkMetrics = await getLinkMetricsForRange(
    authenticatedRequest.authenticatedUser.id,
    linkIdParam,
    dateRange,
  );

  response.status(200).json({
    success: true,
    data: linkMetrics,
  });
};

export const getPlatformMetrics = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const platformParam = request.params.platform as LinkPlatform;
  const dateRange = buildDateRangeFromQuery(request);

  const platformMetrics = await getPlatformMetricsForRange(
    authenticatedRequest.authenticatedUser.id,
    platformParam,
    dateRange,
  );

  response.status(200).json({
    success: true,
    data: platformMetrics,
  });
};

export const getCampaignMetrics = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const campaignParam = request.params.campaign as string;
  const dateRange = buildDateRangeFromQuery(request);

  const campaignMetrics = await getCampaignMetricsForRange(
    authenticatedRequest.authenticatedUser.id,
    campaignParam,
    dateRange,
  );

  response.status(200).json({
    success: true,
    data: campaignMetrics,
  });
};

export const listLinkMetrics = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const dateRange = buildDateRangeFromQuery(request);

  const platformFilter =
    typeof request.query.platform === "string"
      ? (request.query.platform as LinkPlatform)
      : undefined;
  const campaignFilter =
    typeof request.query.campaign === "string"
      ? request.query.campaign
      : undefined;

  const linkMetricsList = await listLinkMetricsForRange(
    authenticatedRequest.authenticatedUser.id,
    dateRange,
    {
      platform: platformFilter,
      campaign: campaignFilter,
    },
  );

  response.status(200).json({
    success: true,
    data: linkMetricsList,
  });
};
