import type { AnyBulkWriteOperation } from "mongoose";
import { Types } from "mongoose";

import { ClickEventModel } from "../api/models/clickEvent.model.js";
import { AdminFunnelMetricsDailyModel } from "../api/models/adminFunnelMetricsDaily.model.js";
import {
  AdminPlatformMetricsDailyModel,
  type AdminPlatformMetricsDailyDocument,
} from "../api/models/adminPlatformMetricsDaily.model.js";
import { AdminUsageMetricsDailyModel } from "../api/models/adminUsageMetricsDaily.model.js";
import { LinkModel } from "../api/models/link.model.js";
import { SessionModel } from "../api/models/session.model.js";
import { UserModel } from "../api/models/user.model.js";
import { computeDayBoundsUtc } from "../utils/dateBounds.utils.js";

export {
  formatDateAsUtcIsoDate,
  getCurrentUtcDateString,
  getPreviousUtcDateString,
} from "../utils/dateBounds.utils.js";

const computeEngagementScore = (avgDuration: number, bounceRate: number): number => {
  const normalizedDurationComponent = Math.min(100, avgDuration);
  const retentionComponent = Math.max(0, (1 - bounceRate) * 100);
  return Number(
    (normalizedDurationComponent * 0.6 + retentionComponent * 0.4).toFixed(2),
  );
};

type PlatformSessionsAggregateRow = {
  _id: string | null;
  sessions: number;
  totalDuration: number;
  bounceSessions: number;
};

type PlatformClicksAggregateRow = {
  _id: string | null;
  clicks: number;
};

export const aggregateAdminPlatformMetricsForDate = async (
  isoDate: string,
): Promise<number> => {
  const { dayStart, dayEnd } = computeDayBoundsUtc(isoDate);

  const [sessionRows, clickRows] = await Promise.all([
    SessionModel.aggregate<PlatformSessionsAggregateRow>([
      { $match: { createdAt: { $gte: dayStart, $lt: dayEnd } } },
      {
        $group: {
          _id: "$platform",
          sessions: { $sum: 1 },
          totalDuration: { $sum: { $ifNull: ["$duration", 0] } },
          bounceSessions: { $sum: { $cond: ["$isBounce", 1, 0] } },
        },
      },
    ]),
    ClickEventModel.aggregate<PlatformClicksAggregateRow>([
      { $match: { timestamp: { $gte: dayStart, $lt: dayEnd } } },
      { $group: { _id: "$platform", clicks: { $sum: 1 } } },
    ]),
  ]);

  const metricsByPlatform = new Map<
    string,
    {
      clicks: number;
      sessions: number;
      totalDuration: number;
      bounceSessions: number;
    }
  >();

  for (const sessionRow of sessionRows) {
    const platform = sessionRow._id ?? "unknown";
    metricsByPlatform.set(platform, {
      clicks: 0,
      sessions: sessionRow.sessions,
      totalDuration: sessionRow.totalDuration,
      bounceSessions: sessionRow.bounceSessions,
    });
  }

  for (const clickRow of clickRows) {
    const platform = clickRow._id ?? "unknown";
    const existingMetrics = metricsByPlatform.get(platform);
    if (existingMetrics) {
      existingMetrics.clicks = clickRow.clicks;
      continue;
    }
    metricsByPlatform.set(platform, {
      clicks: clickRow.clicks,
      sessions: 0,
      totalDuration: 0,
      bounceSessions: 0,
    });
  }

  if (metricsByPlatform.size === 0) {
    return 0;
  }

  const bulkWriteOperations: AnyBulkWriteOperation<AdminPlatformMetricsDailyDocument>[] =
    Array.from(metricsByPlatform.entries()).map(([platform, metrics]) => {
      const avgDuration =
        metrics.sessions > 0 ? metrics.totalDuration / metrics.sessions : 0;
      const bounceRate =
        metrics.sessions > 0 ? metrics.bounceSessions / metrics.sessions : 0;
      const engagementScore = computeEngagementScore(avgDuration, bounceRate);

      return {
        updateOne: {
          filter: { date: isoDate, platform },
          update: {
            $set: {
              clicks: metrics.clicks,
              sessions: metrics.sessions,
              avgDuration,
              bounceRate,
              engagementScore,
            },
          },
          upsert: true,
        },
      };
    });

  await AdminPlatformMetricsDailyModel.bulkWrite(bulkWriteOperations, {
    ordered: false,
  });
  return bulkWriteOperations.length;
};

export const aggregateAdminUsageMetricsForDate = async (
  isoDate: string,
): Promise<number> => {
  const { dayStart, dayEnd } = computeDayBoundsUtc(isoDate);

  const [newUsers, activeUserRows, totalLinksCreated, totalClicks] =
    await Promise.all([
      UserModel.countDocuments({
        isDeleted: false,
        createdAt: { $gte: dayStart, $lt: dayEnd },
      }),
      SessionModel.distinct("userId", {
        createdAt: { $gte: dayStart, $lt: dayEnd },
      }),
      LinkModel.countDocuments({ createdAt: { $gte: dayStart, $lt: dayEnd } }),
      ClickEventModel.countDocuments({ timestamp: { $gte: dayStart, $lt: dayEnd } }),
    ]);

  await AdminUsageMetricsDailyModel.updateOne(
    { date: isoDate },
    {
      $set: {
        newUsers,
        activeUsers: activeUserRows.length,
        totalLinksCreated,
        totalClicks,
      },
    },
    { upsert: true },
  );

  return 1;
};

export const aggregateAdminFunnelMetricsForDate = async (
  isoDate: string,
): Promise<number> => {
  const { dayStart, dayEnd } = computeDayBoundsUtc(isoDate);

  const signupUsers = await UserModel.find({
    isDeleted: false,
    createdAt: { $gte: dayStart, $lt: dayEnd },
  })
    .select("_id subscription")
    .lean();

  const signups = signupUsers.length;
  if (signups === 0) {
    await AdminFunnelMetricsDailyModel.updateOne(
      { date: isoDate },
      { $set: { signups: 0, activatedUsers: 0, proUsers: 0 } },
      { upsert: true },
    );
    return 1;
  }

  const userIds = signupUsers.map((user) => user._id as Types.ObjectId);
  const [linkUserRows, clickUserRows, sessionUserRows] = await Promise.all([
    LinkModel.distinct("userId", { userId: { $in: userIds } }),
    ClickEventModel.distinct("userId", { userId: { $in: userIds } }),
    SessionModel.distinct("userId", { userId: { $in: userIds } }),
  ]);

  const activatedUserIdSet = new Set<string>([
    ...linkUserRows.map((userId) => String(userId)),
    ...clickUserRows.map((userId) => String(userId)),
    ...sessionUserRows.map((userId) => String(userId)),
  ]);

  const activatedUsers = signupUsers.filter((user) =>
    activatedUserIdSet.has(String(user._id)),
  ).length;
  const proUsers = signupUsers.filter((user) => user.subscription === "pro").length;

  await AdminFunnelMetricsDailyModel.updateOne(
    { date: isoDate },
    { $set: { signups, activatedUsers, proUsers } },
    { upsert: true },
  );

  return 1;
};

export type AdminAnalyticsAggregationRunSummary = {
  date: string;
  platformRowsUpserted: number;
  usageRowsUpserted: number;
  funnelRowsUpserted: number;
};

export const aggregateAdminAnalyticsForDate = async (
  isoDate: string,
): Promise<AdminAnalyticsAggregationRunSummary> => {
  const [platformRowsUpserted, usageRowsUpserted, funnelRowsUpserted] =
    await Promise.all([
      aggregateAdminPlatformMetricsForDate(isoDate),
      aggregateAdminUsageMetricsForDate(isoDate),
      aggregateAdminFunnelMetricsForDate(isoDate),
    ]);

  return {
    date: isoDate,
    platformRowsUpserted,
    usageRowsUpserted,
    funnelRowsUpserted,
  };
};

