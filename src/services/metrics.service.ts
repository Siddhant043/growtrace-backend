import { Types } from "mongoose";

import { LinkMetricsDailyModel } from "../api/models/linkMetricsDaily.model";
import { PlatformMetricsDailyModel } from "../api/models/platformMetricsDaily.model";
import { CampaignMetricsDailyModel } from "../api/models/campaignMetricsDaily.model";
import { LinkModel, type LinkPlatform } from "../api/models/link.model";
import {
  ENGAGEMENT_SCROLL_WEIGHT,
  ENGAGEMENT_TIME_WEIGHT,
} from "../api/constants/engagement";
import { formatDateAsUtcIsoDate } from "./metricsAggregation.service";

const DEFAULT_RANGE_DAYS = 30;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type DateRangeInput = {
  fromDate?: string;
  toDate?: string;
};

export type ResolvedDateRange = {
  fromDate: string;
  toDate: string;
};

export type EngagementMetricsSummary = {
  totalSessions: number;
  bounceSessions: number;
  engagedSessions: number;
  avgDuration: number;
  avgScrollDepth: number;
  bounceRate: number;
  engagementScore: number;
};

export type EngagementMetricsRangeResponse = ResolvedDateRange &
  EngagementMetricsSummary;

export type LinkMetricsListItem = EngagementMetricsSummary & {
  linkId: string;
  shortCode: string | null;
  originalUrl: string | null;
  platform: string | null;
  campaign: string | null;
};

export type LinkMetricsListResponse = ResolvedDateRange & {
  filters: {
    platform: string | null;
    campaign: string | null;
  };
  items: LinkMetricsListItem[];
};

const buildEmptyMetricsSummary = (): EngagementMetricsSummary => ({
  totalSessions: 0,
  bounceSessions: 0,
  engagedSessions: 0,
  avgDuration: 0,
  avgScrollDepth: 0,
  bounceRate: 0,
  engagementScore: 0,
});

const isValidIsoDate = (value: string | undefined): value is string =>
  typeof value === "string" && ISO_DATE_REGEX.test(value);

export const resolveDateRange = (
  rangeInput: DateRangeInput,
): ResolvedDateRange => {
  const today = new Date();
  const defaultToDate = formatDateAsUtcIsoDate(today);

  const defaultFromBoundary = new Date(today);
  defaultFromBoundary.setUTCDate(
    defaultFromBoundary.getUTCDate() - (DEFAULT_RANGE_DAYS - 1),
  );
  const defaultFromDate = formatDateAsUtcIsoDate(defaultFromBoundary);

  const resolvedFromDate = isValidIsoDate(rangeInput.fromDate)
    ? rangeInput.fromDate
    : defaultFromDate;
  const resolvedToDate = isValidIsoDate(rangeInput.toDate)
    ? rangeInput.toDate
    : defaultToDate;

  if (resolvedFromDate > resolvedToDate) {
    return { fromDate: resolvedToDate, toDate: resolvedFromDate };
  }

  return { fromDate: resolvedFromDate, toDate: resolvedToDate };
};

type AggregatedRangeRollupRow = {
  totalSessions: number;
  bounceSessions: number;
  engagedSessions: number;
  totalDuration: number;
  totalScrollDepth: number;
};

const computeMetricsSummaryFromRollup = (
  rollupRow: AggregatedRangeRollupRow | null,
): EngagementMetricsSummary => {
  if (!rollupRow || rollupRow.totalSessions === 0) {
    return buildEmptyMetricsSummary();
  }

  const avgDuration = rollupRow.totalDuration / rollupRow.totalSessions;
  const avgScrollDepth = rollupRow.totalScrollDepth / rollupRow.totalSessions;
  const bounceRate = rollupRow.bounceSessions / rollupRow.totalSessions;
  const engagementScore =
    ENGAGEMENT_TIME_WEIGHT * avgDuration +
    ENGAGEMENT_SCROLL_WEIGHT * avgScrollDepth;

  return {
    totalSessions: rollupRow.totalSessions,
    bounceSessions: rollupRow.bounceSessions,
    engagedSessions: rollupRow.engagedSessions,
    avgDuration,
    avgScrollDepth,
    bounceRate,
    engagementScore,
  };
};

const buildRangeRollupGroupStage = () => ({
  $group: {
    _id: null,
    totalSessions: { $sum: "$totalSessions" },
    bounceSessions: { $sum: "$bounceSessions" },
    engagedSessions: { $sum: "$engagedSessions" },
    totalDuration: { $sum: "$totalDuration" },
    totalScrollDepth: { $sum: "$totalScrollDepth" },
  },
});

export const getLinkMetricsForRange = async (
  userId: string,
  linkId: string,
  rangeInput: DateRangeInput,
): Promise<EngagementMetricsRangeResponse> => {
  const { fromDate, toDate } = resolveDateRange(rangeInput);

  const aggregatedRollupRows =
    await LinkMetricsDailyModel.aggregate<AggregatedRangeRollupRow>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          linkId: new Types.ObjectId(linkId),
          date: { $gte: fromDate, $lte: toDate },
        },
      },
      buildRangeRollupGroupStage(),
    ]);

  return {
    fromDate,
    toDate,
    ...computeMetricsSummaryFromRollup(aggregatedRollupRows[0] ?? null),
  };
};

export const getPlatformMetricsForRange = async (
  userId: string,
  platform: LinkPlatform,
  rangeInput: DateRangeInput,
): Promise<EngagementMetricsRangeResponse> => {
  const { fromDate, toDate } = resolveDateRange(rangeInput);

  const aggregatedRollupRows =
    await PlatformMetricsDailyModel.aggregate<AggregatedRangeRollupRow>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          platform,
          date: { $gte: fromDate, $lte: toDate },
        },
      },
      buildRangeRollupGroupStage(),
    ]);

  return {
    fromDate,
    toDate,
    ...computeMetricsSummaryFromRollup(aggregatedRollupRows[0] ?? null),
  };
};

export const getCampaignMetricsForRange = async (
  userId: string,
  campaign: string,
  rangeInput: DateRangeInput,
): Promise<EngagementMetricsRangeResponse> => {
  const { fromDate, toDate } = resolveDateRange(rangeInput);

  const aggregatedRollupRows =
    await CampaignMetricsDailyModel.aggregate<AggregatedRangeRollupRow>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          campaign,
          date: { $gte: fromDate, $lte: toDate },
        },
      },
      buildRangeRollupGroupStage(),
    ]);

  return {
    fromDate,
    toDate,
    ...computeMetricsSummaryFromRollup(aggregatedRollupRows[0] ?? null),
  };
};

type AggregatedLinkRangeRollupRow = AggregatedRangeRollupRow & {
  _id: Types.ObjectId;
  platform: string | null;
  campaign: string | null;
};

export type ListLinkMetricsRangeFilters = {
  platform?: LinkPlatform;
  campaign?: string;
};

export const listLinkMetricsForRange = async (
  userId: string,
  rangeInput: DateRangeInput,
  filterOptions: ListLinkMetricsRangeFilters = {},
): Promise<LinkMetricsListResponse> => {
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

  const aggregatedLinkRollups =
    await LinkMetricsDailyModel.aggregate<AggregatedLinkRangeRollupRow>([
      { $match: matchStage },
      {
        $group: {
          _id: "$linkId",
          platform: { $first: "$platform" },
          campaign: { $first: "$campaign" },
          totalSessions: { $sum: "$totalSessions" },
          bounceSessions: { $sum: "$bounceSessions" },
          engagedSessions: { $sum: "$engagedSessions" },
          totalDuration: { $sum: "$totalDuration" },
          totalScrollDepth: { $sum: "$totalScrollDepth" },
        },
      },
      { $sort: { totalSessions: -1 } },
    ]);

  if (aggregatedLinkRollups.length === 0) {
    return {
      fromDate,
      toDate,
      filters: {
        platform: filterOptions.platform ?? null,
        campaign: filterOptions.campaign ?? null,
      },
      items: [],
    };
  }

  const linkObjectIds = aggregatedLinkRollups.map((rollupRow) => rollupRow._id);

  const linkDocuments = await LinkModel.find(
    { _id: { $in: linkObjectIds } },
    { _id: 1, shortCode: 1, originalUrl: 1, platform: 1, campaign: 1 },
  ).lean();

  const linkDocumentByLinkId = new Map(
    linkDocuments.map((linkDocument) => [
      linkDocument._id.toString(),
      linkDocument,
    ]),
  );

  const items: LinkMetricsListItem[] = aggregatedLinkRollups.map(
    (rollupRow) => {
      const linkDocument = linkDocumentByLinkId.get(rollupRow._id.toString());
      const summary = computeMetricsSummaryFromRollup(rollupRow);

      return {
        linkId: rollupRow._id.toString(),
        shortCode: linkDocument?.shortCode ?? null,
        originalUrl: linkDocument?.originalUrl ?? null,
        platform: linkDocument?.platform ?? rollupRow.platform ?? null,
        campaign: linkDocument?.campaign ?? rollupRow.campaign ?? null,
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
    items,
  };
};
