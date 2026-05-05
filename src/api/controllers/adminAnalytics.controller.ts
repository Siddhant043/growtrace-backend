import type { Request, Response } from "express";

import {
  listAdminFunnelMetrics,
  listAdminPlatformMetrics,
  listAdminUsageMetrics,
} from "../../services/adminAnalytics.service.js";
import type { AdminAnalyticsDateRangeQuery } from "../validators/adminAnalytics.validator.js";

export const listAdminPlatformMetricsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = request.query as unknown as AdminAnalyticsDateRangeQuery;
  const payload = await listAdminPlatformMetrics({
    startDate: query.startDate,
    endDate: query.endDate,
  });
  response.status(200).json(payload);
};

export const listAdminUsageMetricsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = request.query as unknown as AdminAnalyticsDateRangeQuery;
  const payload = await listAdminUsageMetrics({
    startDate: query.startDate,
    endDate: query.endDate,
  });
  response.status(200).json(payload);
};

export const listAdminFunnelMetricsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = request.query as unknown as AdminAnalyticsDateRangeQuery;
  const payload = await listAdminFunnelMetrics({
    startDate: query.startDate,
    endDate: query.endDate,
  });
  response.status(200).json(payload);
};

