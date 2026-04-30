import { Types } from "mongoose";

import { LinkMetricsDailyModel } from "../api/models/linkMetricsDaily.model";
import { PlatformMetricsDailyModel } from "../api/models/platformMetricsDaily.model";
import { type LinkPlatform } from "../api/models/link.model";
import {
  resolveDateRange,
  type DateRangeInput,
  type ResolvedDateRange,
} from "../utils/dateRange.utils";
import {
  buildRangeRollupSumStage,
  computeEngagementMetricsSummaryFromRollup,
  type AggregatedRangeRollupRow,
} from "../utils/metricsRollup.utils";
import {
  listLinkMetricsForRange,
  type LinkMetricsListItem,
  type LinkMetricsListResponse,
} from "./metrics.service";

export type EngagementTrendPoint = {
  date: string;
  totalSessions: number;
  bounceSessions: number;
  engagedSessions: number;
  avgDuration: number;
  avgScrollDepth: number;
  bounceRate: number;
  engagementScore: number;
};

export type EngagementTrendsResponse = ResolvedDateRange & {
  filters: {
    platform: string | null;
    campaign: string | null;
  };
  points: EngagementTrendPoint[];
};

export type PlatformQualityRow = {
  platform: string;
  totalSessions: number;
  bounceSessions: number;
  engagedSessions: number;
  avgDuration: number;
  avgScrollDepth: number;
  bounceRate: number;
  engagementScore: number;
};

export type PlatformQualityResponse = ResolvedDateRange & {
  items: PlatformQualityRow[];
};

export type ContentPerformanceRow = LinkMetricsListItem;

export type ContentPerformanceResponse = ResolvedDateRange & {
  filters: {
    platform: string | null;
    campaign: string | null;
  };
  items: ContentPerformanceRow[];
};

export type EngagementTrendsFilters = {
  platform?: LinkPlatform;
  campaign?: string;
};

export type ContentPerformanceFilters = {
  platform?: LinkPlatform;
  campaign?: string;
  limit?: number;
};

const DEFAULT_CONTENT_PERFORMANCE_LIMIT = 50;
const MAX_CONTENT_PERFORMANCE_LIMIT = 200;

type AggregatedTrendDailyRollupRow = AggregatedRangeRollupRow & {
  _id: string;
};

export const getEngagementTrendsForRange = async (
  userId: string,
  rangeInput: DateRangeInput,
  filterOptions: EngagementTrendsFilters = {},
): Promise<EngagementTrendsResponse> => {
  const { fromDate, toDate } = resolveDateRange(rangeInput);

  const matchStage: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
    date: { $gte: fromDate, $lte: toDate },
  };

  if (filterOptions.platform) {
    matchStage.platform = filterOptions.platform;
  }
  if (filterOptions.campaign) {
    matchStage.campaign = filterOptions.campaign;
  }

  const aggregatedDailyRollupRows =
    await LinkMetricsDailyModel.aggregate<AggregatedTrendDailyRollupRow>([
      { $match: matchStage },
      {
        $group: {
          _id: "$date",
          ...buildRangeRollupSumStage(),
        },
      },
      { $sort: { _id: 1 } },
    ]);

  const points: EngagementTrendPoint[] = aggregatedDailyRollupRows.map(
    (rollupRow) => {
      const summary = computeEngagementMetricsSummaryFromRollup(rollupRow);
      return {
        date: rollupRow._id,
        ...summary,
      };
    },
  );

  return {
    fromDate,
    toDate,
    filters: {
      platform: filterOptions.platform ?? null,
      campaign: filterOptions.campaign ?? null,
    },
    points,
  };
};

type AggregatedPlatformRollupRow = AggregatedRangeRollupRow & {
  _id: string;
};

export const getPlatformQualityComparison = async (
  userId: string,
  rangeInput: DateRangeInput,
): Promise<PlatformQualityResponse> => {
  const { fromDate, toDate } = resolveDateRange(rangeInput);

  const aggregatedPlatformRollupRows =
    await PlatformMetricsDailyModel.aggregate<AggregatedPlatformRollupRow>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: "$platform",
          ...buildRangeRollupSumStage(),
        },
      },
    ]);

  const items: PlatformQualityRow[] = aggregatedPlatformRollupRows
    .map((rollupRow) => {
      const summary = computeEngagementMetricsSummaryFromRollup(rollupRow);
      return {
        platform: rollupRow._id,
        ...summary,
      };
    })
    .sort(
      (rowA, rowB) =>
        rowB.engagementScore - rowA.engagementScore ||
        rowB.totalSessions - rowA.totalSessions,
    );

  return {
    fromDate,
    toDate,
    items,
  };
};

const clampContentPerformanceLimit = (requestedLimit?: number): number => {
  if (typeof requestedLimit !== "number" || Number.isNaN(requestedLimit)) {
    return DEFAULT_CONTENT_PERFORMANCE_LIMIT;
  }
  if (requestedLimit < 1) {
    return 1;
  }
  if (requestedLimit > MAX_CONTENT_PERFORMANCE_LIMIT) {
    return MAX_CONTENT_PERFORMANCE_LIMIT;
  }
  return Math.floor(requestedLimit);
};

export const getContentPerformanceForRange = async (
  userId: string,
  rangeInput: DateRangeInput,
  filterOptions: ContentPerformanceFilters = {},
): Promise<ContentPerformanceResponse> => {
  const linkMetricsListResponse: LinkMetricsListResponse =
    await listLinkMetricsForRange(userId, rangeInput, {
      platform: filterOptions.platform,
      campaign: filterOptions.campaign,
    });

  const effectiveLimit = clampContentPerformanceLimit(filterOptions.limit);

  const sortedByEngagementScore = [...linkMetricsListResponse.items].sort(
    (rowA, rowB) =>
      rowB.engagementScore - rowA.engagementScore ||
      rowB.totalSessions - rowA.totalSessions,
  );

  return {
    fromDate: linkMetricsListResponse.fromDate,
    toDate: linkMetricsListResponse.toDate,
    filters: linkMetricsListResponse.filters,
    items: sortedByEngagementScore.slice(0, effectiveLimit),
  };
};
