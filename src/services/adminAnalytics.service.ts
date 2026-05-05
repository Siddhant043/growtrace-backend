import { AdminFunnelMetricsDailyModel } from "../api/models/adminFunnelMetricsDaily.model.js";
import { AdminPlatformMetricsDailyModel } from "../api/models/adminPlatformMetricsDaily.model.js";
import { AdminUsageMetricsDailyModel } from "../api/models/adminUsageMetricsDaily.model.js";
import {
  formatDateAsUtcIsoDate,
  isValidIsoDate,
} from "../utils/dateBounds.utils.js";

type AdminAnalyticsDateRangeInput = {
  startDate?: string;
  endDate?: string;
};

type ResolvedDateRange = {
  startDate: string;
  endDate: string;
};

const createBadRequestError = (message: string): Error & { statusCode: number } => {
  const badRequestError = new Error(message) as Error & { statusCode: number };
  badRequestError.statusCode = 400;
  return badRequestError;
};

const getDefaultDateRange = (): ResolvedDateRange => {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - 6);
  return {
    startDate: formatDateAsUtcIsoDate(startDate),
    endDate: formatDateAsUtcIsoDate(endDate),
  };
};

const resolveDateRange = (
  input: AdminAnalyticsDateRangeInput,
): ResolvedDateRange => {
  if (!input.startDate && !input.endDate) {
    return getDefaultDateRange();
  }

  if (!input.startDate || !input.endDate) {
    throw createBadRequestError("Both startDate and endDate are required together");
  }

  if (!isValidIsoDate(input.startDate) || !isValidIsoDate(input.endDate)) {
    throw createBadRequestError("Invalid date format. Expected YYYY-MM-DD");
  }

  if (input.startDate > input.endDate) {
    throw createBadRequestError("startDate cannot be later than endDate");
  }

  return { startDate: input.startDate, endDate: input.endDate };
};

export const listAdminPlatformMetrics = async (
  dateRange: AdminAnalyticsDateRangeInput,
) => {
  const resolvedRange = resolveDateRange(dateRange);
  const platformMetrics = await AdminPlatformMetricsDailyModel.find({
    date: { $gte: resolvedRange.startDate, $lte: resolvedRange.endDate },
  })
    .sort({ date: 1, platform: 1 })
    .lean();

  return {
    dateRange: resolvedRange,
    metrics: platformMetrics,
  };
};

export const listAdminUsageMetrics = async (
  dateRange: AdminAnalyticsDateRangeInput,
) => {
  const resolvedRange = resolveDateRange(dateRange);
  const usageMetrics = await AdminUsageMetricsDailyModel.find({
    date: { $gte: resolvedRange.startDate, $lte: resolvedRange.endDate },
  })
    .sort({ date: 1 })
    .lean();

  return {
    dateRange: resolvedRange,
    metrics: usageMetrics,
  };
};

export const listAdminFunnelMetrics = async (
  dateRange: AdminAnalyticsDateRangeInput,
) => {
  const resolvedRange = resolveDateRange(dateRange);
  const funnelMetrics = await AdminFunnelMetricsDailyModel.find({
    date: { $gte: resolvedRange.startDate, $lte: resolvedRange.endDate },
  })
    .sort({ date: 1 })
    .lean();

  return {
    dateRange: resolvedRange,
    metrics: funnelMetrics,
  };
};

