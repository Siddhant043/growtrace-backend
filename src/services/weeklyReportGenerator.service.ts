import { Types } from "mongoose";

import { InsightReadModel } from "../api/models/insightRead.model";
import { LinkMetricsDailyModel } from "../api/models/linkMetricsDaily.model";
import { PlatformMetricsDailyModel } from "../api/models/platformMetricsDaily.model";
import { UserModel } from "../api/models/user.model";
import {
  WeeklyReportModel,
  type WeeklyReportDocument,
} from "../api/models/weeklyReport.model";
import { formatDateAsUtcIsoDate } from "./dateBounds.utils";
import {
  buildWeeklyReportCopy,
  extractFirstName,
  type WeeklyReportCopyOutput,
} from "./weeklyReports.copy";
import {
  computeWeekWindowBefore,
  type WeeklyReportDateWindow,
} from "./weeklyReports.dateWindow";

const TOP_INSIGHTS_LIMIT = 5;
const TOP_RECOMMENDATIONS_LIMIT = 5;
const MILLIS_PER_DAY = 86_400_000;

type PlatformAggregateRow = {
  _id: string;
  totalSessions: number;
  weightedEngagementSum: number;
};

type LinkAggregateRow = {
  _id: Types.ObjectId;
  totalSessions: number;
  weightedEngagementSum: number;
  shortCode: string | null;
  title: string | null;
};

type TrendAggregateRow = {
  _id: string;
  totalSessions: number;
  weightedEngagementSum: number;
  totalDuration: number;
  totalBounceSessions: number;
};

type InsightAggregateRow = {
  _id: Types.ObjectId;
  type: string;
  message: string;
  confidence: number;
};

export type WeeklyReportTrendBucket = {
  date: Date;
  engagementScore: number;
  avgDuration: number;
  bounceRate: number;
  clicks: number;
};

export type WeeklyReportTopPlatform = {
  platform: string | null;
  engagementScore: number;
  clicks: number;
  sessions: number;
};

export type WeeklyReportTopContent = {
  linkId: Types.ObjectId | null;
  shortCode: string | null;
  title: string | null;
  engagementScore: number;
  clicks: number;
};

export type WeeklyReportInsightEntry = {
  insightId: Types.ObjectId | null;
  type: string;
  message: string;
  confidence: number;
};

export type WeeklyReportRecommendationEntry = {
  insightId: Types.ObjectId | null;
  message: string;
  confidence: number;
};

export type WeeklyReportSummary = {
  headline: string;
  deltaPct: number;
  isFirstReport: boolean;
  isMinimal: boolean;
};

export type WeeklyReportPayload = {
  userId: string;
  weekStart: Date;
  weekEnd: Date;
  topPlatform: WeeklyReportTopPlatform;
  topContent: WeeklyReportTopContent;
  trends: WeeklyReportTrendBucket[];
  insights: WeeklyReportInsightEntry[];
  recommendations: WeeklyReportRecommendationEntry[];
  summary: WeeklyReportSummary;
  emailSubject: string;
  ctaLabel: string;
  totalClicks: number;
  totalSessions: number;
  recipientFullName: string;
  recipientEmail: string;
};

export type GenerateWeeklyReportInput = {
  userId: string;
  window: WeeklyReportDateWindow;
};

export type GenerateAndPersistResult = {
  payload: WeeklyReportPayload;
  document: WeeklyReportDocument;
  shouldEmail: boolean;
  skipReason: WeeklyReportSkipReason | null;
};

export type WeeklyReportSkipReason =
  | "user_not_found"
  | "user_opted_out"
  | "new_user_onboarding";

const aggregatePlatformsForWindow = async (
  userObjectId: Types.ObjectId,
  window: WeeklyReportDateWindow,
): Promise<PlatformAggregateRow[]> => {
  return PlatformMetricsDailyModel.aggregate<PlatformAggregateRow>([
    {
      $match: {
        userId: userObjectId,
        date: { $gte: window.weekStartIsoDate, $lte: window.weekEndIsoDate },
      },
    },
    {
      $group: {
        _id: "$platform",
        totalSessions: { $sum: "$totalSessions" },
        weightedEngagementSum: {
          $sum: { $multiply: ["$engagementScore", "$totalSessions"] },
        },
      },
    },
  ]);
};

const aggregateTopLinkForWindow = async (
  userObjectId: Types.ObjectId,
  window: WeeklyReportDateWindow,
): Promise<LinkAggregateRow | null> => {
  const aggregatedRows = await LinkMetricsDailyModel.aggregate<LinkAggregateRow>([
    {
      $match: {
        userId: userObjectId,
        date: { $gte: window.weekStartIsoDate, $lte: window.weekEndIsoDate },
      },
    },
    {
      $group: {
        _id: "$linkId",
        totalSessions: { $sum: "$totalSessions" },
        weightedEngagementSum: {
          $sum: { $multiply: ["$engagementScore", "$totalSessions"] },
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
        title: { $first: "$linkDocs.title" },
      },
    },
    { $project: { linkDocs: 0 } },
    { $sort: { weightedEngagementSum: -1, totalSessions: -1 } },
    { $limit: 1 },
  ]);

  return aggregatedRows.length > 0 ? aggregatedRows[0]! : null;
};

const aggregateDailyTrendsForWindow = async (
  userObjectId: Types.ObjectId,
  window: WeeklyReportDateWindow,
): Promise<TrendAggregateRow[]> => {
  return LinkMetricsDailyModel.aggregate<TrendAggregateRow>([
    {
      $match: {
        userId: userObjectId,
        date: { $gte: window.weekStartIsoDate, $lte: window.weekEndIsoDate },
      },
    },
    {
      $group: {
        _id: "$date",
        totalSessions: { $sum: "$totalSessions" },
        weightedEngagementSum: {
          $sum: { $multiply: ["$engagementScore", "$totalSessions"] },
        },
        totalDuration: { $sum: "$totalDuration" },
        totalBounceSessions: { $sum: "$bounceSessions" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

const aggregateInsightsCreatedDuringWindow = async (
  userId: string,
  window: WeeklyReportDateWindow,
): Promise<InsightAggregateRow[]> => {
  return InsightReadModel.find(
    {
      userId,
      createdAt: {
        $gte: window.weekStart,
        $lte: new Date(window.weekEnd.getTime() + MILLIS_PER_DAY - 1),
      },
    },
    { _id: 1, type: 1, message: 1, confidence: 1 },
  )
    .sort({ confidence: -1, createdAt: -1 })
    .lean<InsightAggregateRow[]>();
};

const computeAverageEngagementScoreFromPlatforms = (
  platformRows: readonly PlatformAggregateRow[],
): number => {
  let totalSessions = 0;
  let weightedEngagementSum = 0;
  for (const row of platformRows) {
    totalSessions += row.totalSessions;
    weightedEngagementSum += row.weightedEngagementSum;
  }
  if (totalSessions === 0) {
    return 0;
  }
  return weightedEngagementSum / totalSessions;
};

const buildTopPlatformPayload = (
  platformRows: readonly PlatformAggregateRow[],
): WeeklyReportTopPlatform => {
  if (platformRows.length === 0) {
    return { platform: null, engagementScore: 0, clicks: 0, sessions: 0 };
  }

  const sortedRows = [...platformRows].sort((firstRow, secondRow) => {
    const firstAverage = firstRow.totalSessions
      ? firstRow.weightedEngagementSum / firstRow.totalSessions
      : 0;
    const secondAverage = secondRow.totalSessions
      ? secondRow.weightedEngagementSum / secondRow.totalSessions
      : 0;
    if (firstAverage !== secondAverage) {
      return secondAverage - firstAverage;
    }
    return secondRow.totalSessions - firstRow.totalSessions;
  });

  const topRow = sortedRows[0]!;
  return {
    platform: topRow._id,
    engagementScore: topRow.totalSessions
      ? topRow.weightedEngagementSum / topRow.totalSessions
      : 0,
    clicks: topRow.totalSessions,
    sessions: topRow.totalSessions,
  };
};

const buildTopContentPayload = (
  topLink: LinkAggregateRow | null,
): WeeklyReportTopContent => {
  if (!topLink) {
    return {
      linkId: null,
      shortCode: null,
      title: null,
      engagementScore: 0,
      clicks: 0,
    };
  }

  return {
    linkId: topLink._id,
    shortCode: topLink.shortCode ?? null,
    title: topLink.title ?? null,
    engagementScore: topLink.totalSessions
      ? topLink.weightedEngagementSum / topLink.totalSessions
      : 0,
    clicks: topLink.totalSessions,
  };
};

const buildTrendBucketsForWindow = (
  trendRows: readonly TrendAggregateRow[],
  window: WeeklyReportDateWindow,
): WeeklyReportTrendBucket[] => {
  const trendRowsByDate = new Map<string, TrendAggregateRow>();
  for (const row of trendRows) {
    trendRowsByDate.set(row._id, row);
  }

  const buckets: WeeklyReportTrendBucket[] = [];
  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const bucketDate = new Date(
      window.weekStart.getTime() + dayOffset * MILLIS_PER_DAY,
    );
    const bucketIsoDate = formatDateAsUtcIsoDate(bucketDate);
    const matchedRow = trendRowsByDate.get(bucketIsoDate);

    if (!matchedRow) {
      buckets.push({
        date: bucketDate,
        engagementScore: 0,
        avgDuration: 0,
        bounceRate: 0,
        clicks: 0,
      });
      continue;
    }

    const safeSessions = matchedRow.totalSessions || 1;
    buckets.push({
      date: bucketDate,
      engagementScore: matchedRow.totalSessions
        ? matchedRow.weightedEngagementSum / matchedRow.totalSessions
        : 0,
      avgDuration: matchedRow.totalDuration / safeSessions,
      bounceRate: matchedRow.totalSessions
        ? matchedRow.totalBounceSessions / matchedRow.totalSessions
        : 0,
      clicks: matchedRow.totalSessions,
    });
  }

  return buckets;
};

const splitInsightRows = (
  insightRows: readonly InsightAggregateRow[],
): {
  insights: WeeklyReportInsightEntry[];
  recommendations: WeeklyReportRecommendationEntry[];
} => {
  const recommendations: WeeklyReportRecommendationEntry[] = [];
  const generalInsights: WeeklyReportInsightEntry[] = [];

  for (const row of insightRows) {
    if (row.type === "recommendation") {
      if (recommendations.length < TOP_RECOMMENDATIONS_LIMIT) {
        recommendations.push({
          insightId: row._id,
          message: row.message,
          confidence: row.confidence,
        });
      }
    } else if (generalInsights.length < TOP_INSIGHTS_LIMIT) {
      generalInsights.push({
        insightId: row._id,
        type: row.type,
        message: row.message,
        confidence: row.confidence,
      });
    }
  }

  return { insights: generalInsights, recommendations };
};

const computeDeltaPct = (
  currentValue: number,
  previousValue: number,
): number => {
  if (previousValue <= 0) {
    if (currentValue <= 0) {
      return 0;
    }
    return 100;
  }
  return ((currentValue - previousValue) / previousValue) * 100;
};

const persistWeeklyReportDocument = async (
  payload: WeeklyReportPayload,
): Promise<WeeklyReportDocument> => {
  const setOnInsertFields = {
    deliveryStatus: "pending" as const,
  };

  const setFields = {
    weekEnd: payload.weekEnd,
    topPlatform: payload.topPlatform,
    topContent: payload.topContent,
    trends: payload.trends,
    insights: payload.insights,
    recommendations: payload.recommendations,
    summary: payload.summary,
  };

  const upserted = await WeeklyReportModel.findOneAndUpdate(
    { userId: payload.userId, weekStart: payload.weekStart },
    {
      $set: setFields,
      $setOnInsert: setOnInsertFields,
    },
    { upsert: true, new: true },
  ).exec();

  if (!upserted) {
    throw new Error(
      "weeklyReportGenerator.service: upsert returned no document",
    );
  }
  return upserted;
};

const buildSkippedDeliverySummary = async (
  userObjectId: Types.ObjectId,
  window: WeeklyReportDateWindow,
  reason: WeeklyReportSkipReason,
): Promise<GenerateAndPersistResult> => {
  const placeholderPayload: WeeklyReportPayload = {
    userId: userObjectId.toHexString(),
    weekStart: window.weekStart,
    weekEnd: window.weekEnd,
    topPlatform: { platform: null, engagementScore: 0, clicks: 0, sessions: 0 },
    topContent: {
      linkId: null,
      shortCode: null,
      title: null,
      engagementScore: 0,
      clicks: 0,
    },
    trends: [],
    insights: [],
    recommendations: [],
    summary: {
      headline: "Welcome to GrowTrace",
      deltaPct: 0,
      isFirstReport: true,
      isMinimal: true,
    },
    emailSubject: "",
    ctaLabel: "",
    totalClicks: 0,
    totalSessions: 0,
    recipientFullName: "",
    recipientEmail: "",
  };

  const upserted = await WeeklyReportModel.findOneAndUpdate(
    { userId: userObjectId, weekStart: window.weekStart },
    {
      $set: {
        weekEnd: window.weekEnd,
        deliveryStatus: "skipped",
        failureReason: reason,
        summary: placeholderPayload.summary,
      },
      $setOnInsert: { topPlatform: {}, topContent: {}, trends: [] },
    },
    { upsert: true, new: true },
  ).exec();

  if (!upserted) {
    throw new Error(
      "weeklyReportGenerator.service: skip-upsert returned no document",
    );
  }

  return {
    payload: placeholderPayload,
    document: upserted,
    shouldEmail: false,
    skipReason: reason,
  };
};

export const generateAndPersistWeeklyReport = async (
  input: GenerateWeeklyReportInput,
): Promise<GenerateAndPersistResult> => {
  const userObjectId = new Types.ObjectId(input.userId);
  const targetWindow = input.window;

  const userRecord = await UserModel.findById(userObjectId).lean();
  if (!userRecord || userRecord.isDeleted) {
    return buildSkippedDeliverySummary(
      userObjectId,
      targetWindow,
      "user_not_found",
    );
  }

  const userCreatedAt = (userRecord as { createdAt?: Date }).createdAt;
  if (userCreatedAt instanceof Date && userCreatedAt > targetWindow.weekEnd) {
    return buildSkippedDeliverySummary(
      userObjectId,
      targetWindow,
      "new_user_onboarding",
    );
  }

  const previousWindow = computeWeekWindowBefore(targetWindow);

  const [
    platformRows,
    topLinkRow,
    trendRows,
    insightRows,
    previousPlatformRows,
    existingPriorReport,
  ] = await Promise.all([
    aggregatePlatformsForWindow(userObjectId, targetWindow),
    aggregateTopLinkForWindow(userObjectId, targetWindow),
    aggregateDailyTrendsForWindow(userObjectId, targetWindow),
    aggregateInsightsCreatedDuringWindow(input.userId, targetWindow),
    aggregatePlatformsForWindow(userObjectId, previousWindow),
    WeeklyReportModel.exists({
      userId: userObjectId,
      weekStart: { $lt: targetWindow.weekStart },
    }),
  ]);

  const topPlatform = buildTopPlatformPayload(platformRows);
  const topContent = buildTopContentPayload(topLinkRow);
  const trends = buildTrendBucketsForWindow(trendRows, targetWindow);
  const { insights, recommendations } = splitInsightRows(insightRows);

  const totalSessions = platformRows.reduce(
    (runningSum, row) => runningSum + row.totalSessions,
    0,
  );
  const totalClicks = trends.reduce(
    (runningSum, bucket) => runningSum + bucket.clicks,
    0,
  );

  const currentEngagementAverage =
    computeAverageEngagementScoreFromPlatforms(platformRows);
  const previousEngagementAverage =
    computeAverageEngagementScoreFromPlatforms(previousPlatformRows);
  const deltaPct = computeDeltaPct(
    currentEngagementAverage,
    previousEngagementAverage,
  );

  const isFirstReport = existingPriorReport === null;
  const isMinimal = totalSessions === 0;

  const recipientFullName: string = userRecord.fullName ?? "";
  const recipientEmail: string = userRecord.email ?? "";

  const copyContext = {
    firstName: extractFirstName(recipientFullName),
    topPlatformName: topPlatform.platform,
    topShortCode: topContent.shortCode,
    deltaPct,
    totalClicks,
    isFirstReport,
    isMinimal,
  };

  const copy: WeeklyReportCopyOutput = buildWeeklyReportCopy(copyContext);

  const summary: WeeklyReportSummary = {
    headline: copy.headline,
    deltaPct,
    isFirstReport,
    isMinimal,
  };

  const payload: WeeklyReportPayload = {
    userId: input.userId,
    weekStart: targetWindow.weekStart,
    weekEnd: targetWindow.weekEnd,
    topPlatform,
    topContent,
    trends,
    insights,
    recommendations,
    summary,
    emailSubject: copy.emailSubject,
    ctaLabel: copy.ctaLabel,
    totalClicks,
    totalSessions,
    recipientFullName,
    recipientEmail,
  };

  const persistedDocument = await persistWeeklyReportDocument(payload);

  const userOptedOut = Boolean(
    (userRecord as { weeklyReportOptOut?: boolean }).weeklyReportOptOut,
  );

  if (userOptedOut) {
    return {
      payload,
      document: persistedDocument,
      shouldEmail: false,
      skipReason: "user_opted_out",
    };
  }

  return {
    payload,
    document: persistedDocument,
    shouldEmail: recipientEmail.length > 0,
    skipReason: null,
  };
};
