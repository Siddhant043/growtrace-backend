import { Types } from "mongoose";

import { LinkFunnelDailyModel } from "../api/models/linkFunnelDaily.model.js";
import { PlatformFunnelDailyModel } from "../api/models/platformFunnelDaily.model.js";
import { CampaignFunnelDailyModel } from "../api/models/campaignFunnelDaily.model.js";
import { LinkModel, type LinkPlatform } from "../api/models/link.model.js";
import {
  resolveDateRange,
  type DateRangeInput,
  type ResolvedDateRange,
} from "../utils/dateRange.utils.js";

export type { DateRangeInput, ResolvedDateRange } from "../utils/dateRange.utils.js";

export type FunnelStageCounts = {
  clicks: number;
  visits: number;
  engaged: number;
  visitRate: number;
  engagementRate: number;
  dropClickToVisit: number;
  dropVisitToEngaged: number;
};

export type FunnelRangeResponse = ResolvedDateRange & FunnelStageCounts;

export type LinkFunnelListItem = FunnelStageCounts & {
  linkId: string;
  shortCode: string | null;
  originalUrl: string | null;
  platform: string | null;
  campaign: string | null;
};

export type LinkFunnelListResponse = ResolvedDateRange & {
  filters: {
    platform: string | null;
    campaign: string | null;
  };
  items: LinkFunnelListItem[];
};

const buildEmptyFunnelStageCounts = (): FunnelStageCounts => ({
  clicks: 0,
  visits: 0,
  engaged: 0,
  visitRate: 0,
  engagementRate: 0,
  dropClickToVisit: 0,
  dropVisitToEngaged: 0,
});

type AggregatedFunnelRangeRollupRow = {
  totalClicks: number;
  totalVisits: number;
  totalEngaged: number;
};

const computeFunnelStageCountsFromRollup = (
  rollupRow: AggregatedFunnelRangeRollupRow | null,
): FunnelStageCounts => {
  if (!rollupRow) {
    return buildEmptyFunnelStageCounts();
  }

  const visitRate =
    rollupRow.totalClicks > 0
      ? rollupRow.totalVisits / rollupRow.totalClicks
      : 0;
  const engagementRate =
    rollupRow.totalVisits > 0
      ? rollupRow.totalEngaged / rollupRow.totalVisits
      : 0;
  const dropClickToVisit =
    rollupRow.totalClicks > 0 ? Math.max(0, 1 - visitRate) : 0;
  const dropVisitToEngaged =
    rollupRow.totalVisits > 0 ? 1 - engagementRate : 0;

  return {
    clicks: rollupRow.totalClicks,
    visits: rollupRow.totalVisits,
    engaged: rollupRow.totalEngaged,
    visitRate,
    engagementRate,
    dropClickToVisit,
    dropVisitToEngaged,
  };
};

const buildFunnelRangeRollupGroupStage = () => ({
  $group: {
    _id: null,
    totalClicks: { $sum: "$clicks" },
    totalVisits: { $sum: "$visits" },
    totalEngaged: { $sum: "$engaged" },
  },
});

export const getLinkFunnelForRange = async (
  userId: string,
  linkId: string,
  rangeInput: DateRangeInput,
): Promise<FunnelRangeResponse> => {
  const { fromDate, toDate } = resolveDateRange(rangeInput);

  const aggregatedRollupRows =
    await LinkFunnelDailyModel.aggregate<AggregatedFunnelRangeRollupRow>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          linkId: new Types.ObjectId(linkId),
          date: { $gte: fromDate, $lte: toDate },
        },
      },
      buildFunnelRangeRollupGroupStage(),
    ]);

  return {
    fromDate,
    toDate,
    ...computeFunnelStageCountsFromRollup(aggregatedRollupRows[0] ?? null),
  };
};

export const getPlatformFunnelForRange = async (
  userId: string,
  platform: LinkPlatform,
  rangeInput: DateRangeInput,
): Promise<FunnelRangeResponse> => {
  const { fromDate, toDate } = resolveDateRange(rangeInput);

  const aggregatedRollupRows =
    await PlatformFunnelDailyModel.aggregate<AggregatedFunnelRangeRollupRow>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          platform,
          date: { $gte: fromDate, $lte: toDate },
        },
      },
      buildFunnelRangeRollupGroupStage(),
    ]);

  return {
    fromDate,
    toDate,
    ...computeFunnelStageCountsFromRollup(aggregatedRollupRows[0] ?? null),
  };
};

export const getCampaignFunnelForRange = async (
  userId: string,
  campaign: string,
  rangeInput: DateRangeInput,
): Promise<FunnelRangeResponse> => {
  const { fromDate, toDate } = resolveDateRange(rangeInput);

  const aggregatedRollupRows =
    await CampaignFunnelDailyModel.aggregate<AggregatedFunnelRangeRollupRow>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          campaign,
          date: { $gte: fromDate, $lte: toDate },
        },
      },
      buildFunnelRangeRollupGroupStage(),
    ]);

  return {
    fromDate,
    toDate,
    ...computeFunnelStageCountsFromRollup(aggregatedRollupRows[0] ?? null),
  };
};

type AggregatedLinkFunnelRangeRollupRow = AggregatedFunnelRangeRollupRow & {
  _id: Types.ObjectId;
  platform: string | null;
  campaign: string | null;
};

export type ListLinkFunnelsRangeFilters = {
  platform?: LinkPlatform;
  campaign?: string;
};

export const listLinkFunnelsForRange = async (
  userId: string,
  rangeInput: DateRangeInput,
  filterOptions: ListLinkFunnelsRangeFilters = {},
): Promise<LinkFunnelListResponse> => {
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
    await LinkFunnelDailyModel.aggregate<AggregatedLinkFunnelRangeRollupRow>([
      { $match: matchStage },
      {
        $group: {
          _id: "$linkId",
          platform: { $first: "$platform" },
          campaign: { $first: "$campaign" },
          totalClicks: { $sum: "$clicks" },
          totalVisits: { $sum: "$visits" },
          totalEngaged: { $sum: "$engaged" },
        },
      },
      { $sort: { totalClicks: -1 } },
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

  const items: LinkFunnelListItem[] = aggregatedLinkRollups.map((rollupRow) => {
    const linkDocument = linkDocumentByLinkId.get(rollupRow._id.toString());
    const stageCounts = computeFunnelStageCountsFromRollup(rollupRow);

    return {
      linkId: rollupRow._id.toString(),
      shortCode: linkDocument?.shortCode ?? null,
      originalUrl: linkDocument?.originalUrl ?? null,
      platform: linkDocument?.platform ?? rollupRow.platform ?? null,
      campaign: linkDocument?.campaign ?? rollupRow.campaign ?? null,
      ...stageCounts,
    };
  });

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
