import type { AnyBulkWriteOperation } from "mongoose";
import { Types } from "mongoose";

import { SessionModel } from "../api/models/session.model";
import type { LinkPlatform } from "../api/models/link.model";
import {
  LinkMetricsDailyModel,
  type LinkMetricsDailyDocument,
} from "../api/models/linkMetricsDaily.model";
import {
  PlatformMetricsDailyModel,
  type PlatformMetricsDailyDocument,
} from "../api/models/platformMetricsDaily.model";
import {
  CampaignMetricsDailyModel,
  type CampaignMetricsDailyDocument,
} from "../api/models/campaignMetricsDaily.model";
import {
  ENGAGED_DURATION_THRESHOLD_SECONDS,
  ENGAGED_SCROLL_DEPTH_THRESHOLD,
  ENGAGEMENT_SCROLL_WEIGHT,
  ENGAGEMENT_TIME_WEIGHT,
  SESSION_DURATION_CAP_SECONDS,
} from "../api/constants/engagement";
import { computeDayBoundsUtc } from "../utils/dateBounds.utils";

export {
  formatDateAsUtcIsoDate,
  getCurrentUtcDateString,
  getPreviousUtcDateString,
} from "../utils/dateBounds.utils";

type AggregatedMetricRow = {
  totalSessions: number;
  bounceSessions: number;
  engagedSessions: number;
  totalDuration: number;
  totalScrollDepth: number;
  avgDuration: number;
  avgScrollDepth: number;
  bounceRate: number;
  engagementScore: number;
};

type LinkAggregateRow = AggregatedMetricRow & {
  _id: {
    userId: Types.ObjectId;
    linkId: Types.ObjectId;
    platform: LinkPlatform | null;
    campaign: string | null;
  };
};

type PlatformAggregateRow = AggregatedMetricRow & {
  _id: {
    userId: Types.ObjectId;
    platform: LinkPlatform;
  };
};

type CampaignAggregateRow = AggregatedMetricRow & {
  _id: {
    userId: Types.ObjectId;
    campaign: string;
  };
};

const buildSharedAggregationStages = (dayStart: Date, dayEnd: Date) => [
  {
    $match: {
      createdAt: { $gte: dayStart, $lt: dayEnd },
    },
  },
  {
    $addFields: {
      cappedDuration: {
        $min: [{ $ifNull: ["$duration", 0] }, SESSION_DURATION_CAP_SECONDS],
      },
      safeScrollDepth: { $ifNull: ["$maxScrollDepth", 0] },
    },
  },
];

const buildPostGroupStages = () => [
  {
    $addFields: {
      avgDuration: {
        $cond: [
          { $gt: ["$totalSessions", 0] },
          { $divide: ["$totalDuration", "$totalSessions"] },
          0,
        ],
      },
      avgScrollDepth: {
        $cond: [
          { $gt: ["$totalSessions", 0] },
          { $divide: ["$totalScrollDepth", "$totalSessions"] },
          0,
        ],
      },
      bounceRate: {
        $cond: [
          { $gt: ["$totalSessions", 0] },
          { $divide: ["$bounceSessions", "$totalSessions"] },
          0,
        ],
      },
    },
  },
  {
    $addFields: {
      engagementScore: {
        $add: [
          { $multiply: [ENGAGEMENT_TIME_WEIGHT, "$avgDuration"] },
          { $multiply: [ENGAGEMENT_SCROLL_WEIGHT, "$avgScrollDepth"] },
        ],
      },
    },
  },
];

const buildGroupAccumulators = () => ({
  totalSessions: { $sum: 1 },
  bounceSessions: { $sum: { $cond: ["$isBounce", 1, 0] } },
  totalDuration: { $sum: "$cappedDuration" },
  totalScrollDepth: { $sum: "$safeScrollDepth" },
  engagedSessions: {
    $sum: {
      $cond: [
        {
          $and: [
            { $gt: ["$cappedDuration", ENGAGED_DURATION_THRESHOLD_SECONDS] },
            { $gt: ["$safeScrollDepth", ENGAGED_SCROLL_DEPTH_THRESHOLD] },
          ],
        },
        1,
        0,
      ],
    },
  },
});

export const aggregateLinkMetricsForDate = async (
  isoDate: string,
): Promise<number> => {
  const { dayStart, dayEnd } = computeDayBoundsUtc(isoDate);

  const aggregatedRows = await SessionModel.aggregate<LinkAggregateRow>([
    ...buildSharedAggregationStages(dayStart, dayEnd),
    { $match: { linkId: { $ne: null } } },
    {
      $group: {
        _id: {
          userId: "$userId",
          linkId: "$linkId",
          platform: "$platform",
          campaign: "$campaign",
        },
        ...buildGroupAccumulators(),
      },
    },
    ...buildPostGroupStages(),
  ]);

  if (aggregatedRows.length === 0) {
    return 0;
  }

  const bulkWriteOperations: AnyBulkWriteOperation<LinkMetricsDailyDocument>[] =
    aggregatedRows.map((aggregateRow) => ({
      updateOne: {
        filter: {
          userId: aggregateRow._id.userId,
          linkId: aggregateRow._id.linkId,
          date: isoDate,
        },
        update: {
          $set: {
            platform: aggregateRow._id.platform,
            campaign: aggregateRow._id.campaign,
            totalSessions: aggregateRow.totalSessions,
            bounceSessions: aggregateRow.bounceSessions,
            engagedSessions: aggregateRow.engagedSessions,
            totalDuration: aggregateRow.totalDuration,
            totalScrollDepth: aggregateRow.totalScrollDepth,
            avgDuration: aggregateRow.avgDuration,
            avgScrollDepth: aggregateRow.avgScrollDepth,
            bounceRate: aggregateRow.bounceRate,
            engagementScore: aggregateRow.engagementScore,
          },
        },
        upsert: true,
      },
    }));

  await LinkMetricsDailyModel.bulkWrite(bulkWriteOperations, { ordered: false });
  return aggregatedRows.length;
};

export const aggregatePlatformMetricsForDate = async (
  isoDate: string,
): Promise<number> => {
  const { dayStart, dayEnd } = computeDayBoundsUtc(isoDate);

  const aggregatedRows = await SessionModel.aggregate<PlatformAggregateRow>([
    ...buildSharedAggregationStages(dayStart, dayEnd),
    { $match: { platform: { $ne: null } } },
    {
      $group: {
        _id: {
          userId: "$userId",
          platform: "$platform",
        },
        ...buildGroupAccumulators(),
      },
    },
    ...buildPostGroupStages(),
  ]);

  if (aggregatedRows.length === 0) {
    return 0;
  }

  const bulkWriteOperations: AnyBulkWriteOperation<PlatformMetricsDailyDocument>[] =
    aggregatedRows.map((aggregateRow) => ({
      updateOne: {
        filter: {
          userId: aggregateRow._id.userId,
          platform: aggregateRow._id.platform,
          date: isoDate,
        },
        update: {
          $set: {
            totalSessions: aggregateRow.totalSessions,
            bounceSessions: aggregateRow.bounceSessions,
            engagedSessions: aggregateRow.engagedSessions,
            totalDuration: aggregateRow.totalDuration,
            totalScrollDepth: aggregateRow.totalScrollDepth,
            avgDuration: aggregateRow.avgDuration,
            avgScrollDepth: aggregateRow.avgScrollDepth,
            bounceRate: aggregateRow.bounceRate,
            engagementScore: aggregateRow.engagementScore,
          },
        },
        upsert: true,
      },
    }));

  await PlatformMetricsDailyModel.bulkWrite(bulkWriteOperations, {
    ordered: false,
  });
  return aggregatedRows.length;
};

export const aggregateCampaignMetricsForDate = async (
  isoDate: string,
): Promise<number> => {
  const { dayStart, dayEnd } = computeDayBoundsUtc(isoDate);

  const aggregatedRows = await SessionModel.aggregate<CampaignAggregateRow>([
    ...buildSharedAggregationStages(dayStart, dayEnd),
    { $match: { campaign: { $nin: [null, ""] } } },
    {
      $group: {
        _id: {
          userId: "$userId",
          campaign: "$campaign",
        },
        ...buildGroupAccumulators(),
      },
    },
    ...buildPostGroupStages(),
  ]);

  if (aggregatedRows.length === 0) {
    return 0;
  }

  const bulkWriteOperations: AnyBulkWriteOperation<CampaignMetricsDailyDocument>[] =
    aggregatedRows.map((aggregateRow) => ({
      updateOne: {
        filter: {
          userId: aggregateRow._id.userId,
          campaign: aggregateRow._id.campaign,
          date: isoDate,
        },
        update: {
          $set: {
            totalSessions: aggregateRow.totalSessions,
            bounceSessions: aggregateRow.bounceSessions,
            engagedSessions: aggregateRow.engagedSessions,
            totalDuration: aggregateRow.totalDuration,
            totalScrollDepth: aggregateRow.totalScrollDepth,
            avgDuration: aggregateRow.avgDuration,
            avgScrollDepth: aggregateRow.avgScrollDepth,
            bounceRate: aggregateRow.bounceRate,
            engagementScore: aggregateRow.engagementScore,
          },
        },
        upsert: true,
      },
    }));

  await CampaignMetricsDailyModel.bulkWrite(bulkWriteOperations, {
    ordered: false,
  });
  return aggregatedRows.length;
};

export type AggregationRunSummary = {
  date: string;
  linkRowsUpserted: number;
  platformRowsUpserted: number;
  campaignRowsUpserted: number;
};

export const aggregateAllScopesForDate = async (
  isoDate: string,
): Promise<AggregationRunSummary> => {
  const [linkRowsUpserted, platformRowsUpserted, campaignRowsUpserted] =
    await Promise.all([
      aggregateLinkMetricsForDate(isoDate),
      aggregatePlatformMetricsForDate(isoDate),
      aggregateCampaignMetricsForDate(isoDate),
    ]);

  return {
    date: isoDate,
    linkRowsUpserted,
    platformRowsUpserted,
    campaignRowsUpserted,
  };
};

