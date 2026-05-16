import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/authenticate.js";
import type { LinkPlatform } from "../models/link.model.js";
import {
  getAccountFunnelDailySeriesForRange,
  getAccountFunnelOverviewForRange,
  getCampaignFunnelForRange,
  getLinkFunnelForRange,
  getPlatformFunnelForRange,
  listLinkFunnelsForRange,
  listPlatformFunnelsForRange,
} from "../../services/funnel.service.js";

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

export const getLinkFunnel = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const linkIdParam = request.params.linkId as string;
  const dateRange = buildDateRangeFromQuery(request);

  const linkFunnel = await getLinkFunnelForRange(
    authenticatedRequest.authenticatedUser.id,
    linkIdParam,
    dateRange,
  );

  response.status(200).json({
    success: true,
    data: linkFunnel,
  });
};

export const getPlatformFunnel = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const platformParam = request.params.platform as LinkPlatform;
  const dateRange = buildDateRangeFromQuery(request);

  const platformFunnel = await getPlatformFunnelForRange(
    authenticatedRequest.authenticatedUser.id,
    platformParam,
    dateRange,
  );

  response.status(200).json({
    success: true,
    data: platformFunnel,
  });
};

export const getCampaignFunnel = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const campaignParam = request.params.campaign as string;
  const dateRange = buildDateRangeFromQuery(request);

  const campaignFunnel = await getCampaignFunnelForRange(
    authenticatedRequest.authenticatedUser.id,
    campaignParam,
    dateRange,
  );

  response.status(200).json({
    success: true,
    data: campaignFunnel,
  });
};

const buildFunnelRangeFiltersFromQuery = (
  request: Request,
): {
  platform?: LinkPlatform;
  campaign?: string;
} => {
  const platformFilter =
    typeof request.query.platform === "string"
      ? (request.query.platform as LinkPlatform)
      : undefined;
  const campaignFilter =
    typeof request.query.campaign === "string"
      ? request.query.campaign
      : undefined;

  return {
    platform: platformFilter,
    campaign: campaignFilter,
  };
};

export const getFunnelOverview = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const dateRange = buildDateRangeFromQuery(request);
  const rangeFilters = buildFunnelRangeFiltersFromQuery(request);

  const funnelOverview = await getAccountFunnelOverviewForRange(
    authenticatedRequest.authenticatedUser.id,
    dateRange,
    rangeFilters,
  );

  response.status(200).json({
    success: true,
    data: funnelOverview,
  });
};

export const getFunnelDailySeries = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const dateRange = buildDateRangeFromQuery(request);
  const rangeFilters = buildFunnelRangeFiltersFromQuery(request);

  const funnelDailySeries = await getAccountFunnelDailySeriesForRange(
    authenticatedRequest.authenticatedUser.id,
    dateRange,
    rangeFilters,
  );

  response.status(200).json({
    success: true,
    data: funnelDailySeries,
  });
};

export const listPlatformFunnels = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const dateRange = buildDateRangeFromQuery(request);
  const rangeFilters = buildFunnelRangeFiltersFromQuery(request);

  const platformFunnelList = await listPlatformFunnelsForRange(
    authenticatedRequest.authenticatedUser.id,
    dateRange,
    { campaign: rangeFilters.campaign },
  );

  response.status(200).json({
    success: true,
    data: platformFunnelList,
  });
};

export const listLinkFunnels = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const dateRange = buildDateRangeFromQuery(request);
  const rangeFilters = buildFunnelRangeFiltersFromQuery(request);

  const searchFilter =
    typeof request.query.search === "string" ? request.query.search : undefined;
  const pageFilter =
    typeof request.query.page === "string"
      ? Number.parseInt(request.query.page, 10)
      : undefined;
  const pageSizeFilter =
    typeof request.query.pageSize === "string"
      ? Number.parseInt(request.query.pageSize, 10)
      : undefined;

  const linkFunnelList = await listLinkFunnelsForRange(
    authenticatedRequest.authenticatedUser.id,
    dateRange,
    {
      ...rangeFilters,
      search: searchFilter,
      page: pageFilter,
      pageSize: pageSizeFilter,
    },
  );

  response.status(200).json({
    success: true,
    data: linkFunnelList,
  });
};
