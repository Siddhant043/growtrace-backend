import { Types } from "mongoose";

import { LinkMetricsDailyModel } from "../api/models/linkMetricsDaily.model";
import { LinkModel } from "../api/models/link.model";
import { PlatformMetricsDailyModel } from "../api/models/platformMetricsDaily.model";
import { formatDateAsUtcIsoDate } from "./dateBounds.utils";

const DEFAULT_SNAPSHOT_WINDOW_DAYS = 7;
const TOP_LINK_LIMIT_PER_SNAPSHOT = 25;

type PlatformMetricEntry = {
  platform: string;
  clicks: number;
  avgDuration: number;
  bounceRate: number;
  engagementScore: number;
};

type LinkMetricEntry = {
  linkId: string;
  shortCode: string | null;
  clicks: number;
  avgDuration: number;
  bounceRate: number;
  engagementScore: number;
};

type TrendMetricEntry = {
  date: string;
  engagementScore: number;
};

export type UserAnalyticsSnapshotPayload = {
  userId: string;
  asOfDate: string;
  windowDays: number;
  platformMetrics: PlatformMetricEntry[];
  linkMetrics: LinkMetricEntry[];
  trendMetrics: TrendMetricEntry[];
};

const computeRollingWindowStartDateString = (
  asOfDateIso: string,
  windowDays: number,
): string => {
  const asOfDate = new Date(`${asOfDateIso}T00:00:00.000Z`);
  asOfDate.setUTCDate(asOfDate.getUTCDate() - (windowDays - 1));
  return formatDateAsUtcIsoDate(asOfDate);
};

const aggregatePlatformMetricsForUser = async (
  userObjectId: Types.ObjectId,
  fromDate: string,
  toDate: string,
): Promise<PlatformMetricEntry[]> => {
  type PlatformAggregationRow = {
    _id: string;
    totalClicks: number;
    totalDuration: number;
    bounceSessions: number;
    weightedEngagementSum: number;
    avgScrollDepthWeighted: number;
  };

  const platformAggregationRows =
    await PlatformMetricsDailyModel.aggregate<PlatformAggregationRow>([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: "$platform",
          totalClicks: { $sum: "$totalSessions" },
          totalDuration: { $sum: "$totalDuration" },
          bounceSessions: { $sum: "$bounceSessions" },
          weightedEngagementSum: {
            $sum: {
              $multiply: ["$engagementScore", "$totalSessions"],
            },
          },
          avgScrollDepthWeighted: {
            $sum: {
              $multiply: ["$avgScrollDepth", "$totalSessions"],
            },
          },
        },
      },
      { $sort: { totalClicks: -1 } },
    ]);

  return platformAggregationRows.map<PlatformMetricEntry>((row) => {
    const safeClicks = row.totalClicks > 0 ? row.totalClicks : 1;
    return {
      platform: row._id,
      clicks: row.totalClicks,
      avgDuration: row.totalDuration / safeClicks,
      bounceRate:
        row.totalClicks > 0 ? row.bounceSessions / row.totalClicks : 0,
      engagementScore: row.weightedEngagementSum / safeClicks,
    };
  });
};

const aggregateLinkMetricsForUser = async (
  userObjectId: Types.ObjectId,
  fromDate: string,
  toDate: string,
): Promise<LinkMetricEntry[]> => {
  type LinkAggregationRow = {
    _id: Types.ObjectId;
    totalClicks: number;
    totalDuration: number;
    bounceSessions: number;
    weightedEngagementSum: number;
    shortCode: string | null;
  };

  const linkAggregationRows =
    await LinkMetricsDailyModel.aggregate<LinkAggregationRow>([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: "$linkId",
          totalClicks: { $sum: "$totalSessions" },
          totalDuration: { $sum: "$totalDuration" },
          bounceSessions: { $sum: "$bounceSessions" },
          weightedEngagementSum: {
            $sum: {
              $multiply: ["$engagementScore", "$totalSessions"],
            },
          },
        },
      },
      {
        $lookup: {
          from: "links",
          localField: "_id",
          foreignField: "_id",
          as: "linkDocs",
        },
      },
      {
        $addFields: {
          shortCode: { $first: "$linkDocs.shortCode" },
        },
      },
      { $project: { linkDocs: 0 } },
      { $sort: { totalClicks: -1 } },
      { $limit: TOP_LINK_LIMIT_PER_SNAPSHOT },
    ]);

  return linkAggregationRows.map<LinkMetricEntry>((row) => {
    const safeClicks = row.totalClicks > 0 ? row.totalClicks : 1;
    return {
      linkId: row._id.toHexString(),
      shortCode: row.shortCode ?? null,
      clicks: row.totalClicks,
      avgDuration: row.totalDuration / safeClicks,
      bounceRate:
        row.totalClicks > 0 ? row.bounceSessions / row.totalClicks : 0,
      engagementScore: row.weightedEngagementSum / safeClicks,
    };
  });
};

const aggregateTrendMetricsForUser = async (
  userObjectId: Types.ObjectId,
  fromDate: string,
  toDate: string,
): Promise<TrendMetricEntry[]> => {
  type TrendAggregationRow = {
    _id: string;
    totalClicks: number;
    weightedEngagementSum: number;
  };

  const trendAggregationRows =
    await LinkMetricsDailyModel.aggregate<TrendAggregationRow>([
      {
        $match: {
          userId: userObjectId,
          date: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: "$date",
          totalClicks: { $sum: "$totalSessions" },
          weightedEngagementSum: {
            $sum: {
              $multiply: ["$engagementScore", "$totalSessions"],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

  return trendAggregationRows.map<TrendMetricEntry>((row) => ({
    date: row._id,
    engagementScore:
      row.totalClicks > 0 ? row.weightedEngagementSum / row.totalClicks : 0,
  }));
};

export const buildUserAnalyticsSnapshot = async (
  userId: string,
  asOfDateIso: string,
  windowDays: number = DEFAULT_SNAPSHOT_WINDOW_DAYS,
): Promise<UserAnalyticsSnapshotPayload> => {
  const userObjectId = new Types.ObjectId(userId);
  const windowStartDateIso = computeRollingWindowStartDateString(
    asOfDateIso,
    windowDays,
  );

  const [platformMetrics, linkMetrics, trendMetrics] = await Promise.all([
    aggregatePlatformMetricsForUser(
      userObjectId,
      windowStartDateIso,
      asOfDateIso,
    ),
    aggregateLinkMetricsForUser(userObjectId, windowStartDateIso, asOfDateIso),
    aggregateTrendMetricsForUser(
      userObjectId,
      windowStartDateIso,
      asOfDateIso,
    ),
  ]);

  return {
    userId,
    asOfDate: asOfDateIso,
    windowDays,
    platformMetrics,
    linkMetrics,
    trendMetrics,
  };
};

export const findActiveUserIdsForDate = async (
  asOfDateIso: string,
): Promise<string[]> => {
  const distinctOwnerIdsForDate = await LinkMetricsDailyModel.distinct(
    "userId",
    { date: asOfDateIso },
  );

  if (distinctOwnerIdsForDate.length === 0) {
    return [];
  }

  const linksHaveAtLeastOneOwner = await LinkModel.exists({
    userId: { $in: distinctOwnerIdsForDate },
  });
  if (!linksHaveAtLeastOneOwner) {
    return [];
  }

  return distinctOwnerIdsForDate.map((rawObjectId) => {
    if (rawObjectId instanceof Types.ObjectId) {
      return rawObjectId.toHexString();
    }
    return String(rawObjectId);
  });
};
