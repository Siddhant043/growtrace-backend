import { Types, type PipelineStage } from "mongoose";

import { env } from "../config/env.js";
import { LinkMetricsDailyModel } from "../api/models/linkMetricsDaily.model.js";
import { PlatformMetricsDailyModel } from "../api/models/platformMetricsDaily.model.js";
import { LinkModel } from "../api/models/link.model.js";
import { AlertModel, type AlertType } from "../api/models/alert.model.js";
import { AlertRuleModel } from "../api/models/alertRule.model.js";
import {
  formatDateAsUtcIsoDate,
  getCurrentUtcDateString,
  getPreviousUtcDateString,
} from "../utils/dateBounds.utils.js";
type AlertRuleConfig = {
  enabled: boolean;
  cooldownHours: number;
  thresholds: {
    dropPercent: number | null;
    spikeMultiplier: number | null;
  };
};

const TRAFFIC_SPIKE_BASELINE_DAYS = 7;

export interface DetectedAlertCandidate {
  type: AlertType;
  headline: string;
  message: string;
  metadataKey: string;
  metadata: Record<string, string | number | boolean | null>;
  deepLinkPath: string;
  occurredAtMs: number;
}

interface UserDailyEngagementRow {
  date: string;
  weightedEngagementSum: number;
  totalSessions: number;
  avgEngagementScore: number;
}

const computeWeightedDailyEngagementForUser = async (
  userId: string,
  isoDate: string,
): Promise<UserDailyEngagementRow | null> => {
  const aggregationPipeline: PipelineStage[] = [
    {
      $match: {
        userId: new Types.ObjectId(userId),
        date: isoDate,
      },
    },
    {
      $group: {
        _id: null,
        weightedEngagementSum: {
          $sum: {
            $multiply: [
              { $ifNull: ["$engagementScore", 0] },
              { $ifNull: ["$totalSessions", 0] },
            ],
          },
        },
        totalSessions: { $sum: { $ifNull: ["$totalSessions", 0] } },
      },
    },
  ];

  const aggregationResult = await PlatformMetricsDailyModel.aggregate<{
    _id: null;
    weightedEngagementSum: number;
    totalSessions: number;
  }>(aggregationPipeline);

  const aggregatedRow = aggregationResult[0];
  if (!aggregatedRow || aggregatedRow.totalSessions === 0) {
    return null;
  }

  const avgEngagementScore =
    aggregatedRow.weightedEngagementSum / aggregatedRow.totalSessions;

  return {
    date: isoDate,
    weightedEngagementSum: aggregatedRow.weightedEngagementSum,
    totalSessions: aggregatedRow.totalSessions,
    avgEngagementScore,
  };
};

export const evaluateEngagementDropForUser = async (
  userId: string,
  dropThresholdRatio: number = env.ALERTS_ENGAGEMENT_DROP_THRESHOLD,
): Promise<DetectedAlertCandidate | null> => {
  const todayIso = getCurrentUtcDateString();
  const yesterdayIso = getPreviousUtcDateString();

  const [todayEngagement, yesterdayEngagement] = await Promise.all([
    computeWeightedDailyEngagementForUser(userId, todayIso),
    computeWeightedDailyEngagementForUser(userId, yesterdayIso),
  ]);

  if (!todayEngagement || !yesterdayEngagement) {
    return null;
  }

  if (yesterdayEngagement.totalSessions < env.ALERTS_MIN_SESSIONS_FOR_SIGNAL) {
    return null;
  }

  if (todayEngagement.avgEngagementScore <= 0) {
    return null;
  }

  const dropRatio =
    todayEngagement.avgEngagementScore /
    Math.max(yesterdayEngagement.avgEngagementScore, 0.0001);

  if (dropRatio >= dropThresholdRatio) {
    return null;
  }

  const dropPercentage = Math.round((1 - dropRatio) * 100);

  return {
    type: "engagement_drop",
    headline: "Your engagement dropped today",
    message: `Engagement is down ${dropPercentage}% today vs yesterday. Today: ${todayEngagement.avgEngagementScore.toFixed(1)}, yesterday: ${yesterdayEngagement.avgEngagementScore.toFixed(1)}.`,
    metadataKey: `date=${todayIso}`,
    metadata: {
      changePercent: dropPercentage,
      todayAvgEngagement: Number(todayEngagement.avgEngagementScore.toFixed(2)),
      yesterdayAvgEngagement: Number(
        yesterdayEngagement.avgEngagementScore.toFixed(2),
      ),
      todaySessions: todayEngagement.totalSessions,
      yesterdaySessions: yesterdayEngagement.totalSessions,
      thresholdRatio: env.ALERTS_ENGAGEMENT_DROP_THRESHOLD,
      configuredThresholdRatio: dropThresholdRatio,
      dateIso: todayIso,
    },
    deepLinkPath: "/analytics/advanced",
    occurredAtMs: Date.now(),
  };
};

interface PlatformDailySessionRow {
  platform: string;
  totalSessions: number;
}

const aggregatePerPlatformSessionsForDate = async (
  userId: string,
  isoDate: string,
): Promise<PlatformDailySessionRow[]> => {
  const aggregationPipeline: PipelineStage[] = [
    {
      $match: {
        userId: new Types.ObjectId(userId),
        date: isoDate,
      },
    },
    {
      $project: {
        platform: 1,
        totalSessions: { $ifNull: ["$totalSessions", 0] },
      },
    },
  ];

  const aggregationResult = await PlatformMetricsDailyModel.aggregate<{
    _id: Types.ObjectId;
    platform: string;
    totalSessions: number;
  }>(aggregationPipeline);

  return aggregationResult.map((row) => ({
    platform: row.platform,
    totalSessions: row.totalSessions,
  }));
};

interface PlatformBaselineRow {
  platform: string;
  avgSessions: number;
  daysObserved: number;
}

const aggregatePerPlatformBaselineForUser = async (
  userId: string,
  baselineWindowStartIso: string,
  baselineWindowEndIso: string,
): Promise<Map<string, PlatformBaselineRow>> => {
  const aggregationPipeline: PipelineStage[] = [
    {
      $match: {
        userId: new Types.ObjectId(userId),
        date: { $gte: baselineWindowStartIso, $lte: baselineWindowEndIso },
      },
    },
    {
      $group: {
        _id: "$platform",
        totalSessions: { $sum: { $ifNull: ["$totalSessions", 0] } },
        daysObserved: { $sum: 1 },
      },
    },
  ];

  const aggregationResult = await PlatformMetricsDailyModel.aggregate<{
    _id: string;
    totalSessions: number;
    daysObserved: number;
  }>(aggregationPipeline);

  const baselineMap = new Map<string, PlatformBaselineRow>();
  for (const aggregateRow of aggregationResult) {
    const observedDays = Math.max(aggregateRow.daysObserved, 1);
    baselineMap.set(aggregateRow._id, {
      platform: aggregateRow._id,
      avgSessions: aggregateRow.totalSessions / observedDays,
      daysObserved: aggregateRow.daysObserved,
    });
  }

  return baselineMap;
};

const computeBaselineWindow = (): {
  baselineWindowStartIso: string;
  baselineWindowEndIso: string;
} => {
  const baselineEnd = new Date();
  baselineEnd.setUTCDate(baselineEnd.getUTCDate() - 1);

  const baselineStart = new Date(baselineEnd);
  baselineStart.setUTCDate(
    baselineStart.getUTCDate() - (TRAFFIC_SPIKE_BASELINE_DAYS - 1),
  );

  return {
    baselineWindowStartIso: formatDateAsUtcIsoDate(baselineStart),
    baselineWindowEndIso: formatDateAsUtcIsoDate(baselineEnd),
  };
};

export const evaluateTrafficSpikesForUser = async (
  userId: string,
  spikeMultiplier: number = env.ALERTS_TRAFFIC_SPIKE_MULTIPLIER,
): Promise<DetectedAlertCandidate[]> => {
  const todayIso = getCurrentUtcDateString();
  const { baselineWindowStartIso, baselineWindowEndIso } = computeBaselineWindow();

  const [todayPlatformRows, baselineByPlatform] = await Promise.all([
    aggregatePerPlatformSessionsForDate(userId, todayIso),
    aggregatePerPlatformBaselineForUser(
      userId,
      baselineWindowStartIso,
      baselineWindowEndIso,
    ),
  ]);

  const detectedSpikes: DetectedAlertCandidate[] = [];

  for (const todayRow of todayPlatformRows) {
    const baselineRow = baselineByPlatform.get(todayRow.platform);
    if (!baselineRow) {
      continue;
    }

    if (baselineRow.avgSessions < env.ALERTS_MIN_SESSIONS_FOR_SIGNAL) {
      continue;
    }

    const spikeThreshold = baselineRow.avgSessions * spikeMultiplier;

    if (todayRow.totalSessions <= spikeThreshold) {
      continue;
    }

    const liftPercent = Math.round(
      (todayRow.totalSessions / baselineRow.avgSessions - 1) * 100,
    );

    detectedSpikes.push({
      type: "traffic_spike",
      headline: `Traffic spike detected on ${todayRow.platform}`,
      message: `Sessions on ${todayRow.platform} are up ${liftPercent}% today vs the 7-day average. Today: ${todayRow.totalSessions}, baseline: ${baselineRow.avgSessions.toFixed(1)}/day.`,
      metadataKey: `platform=${todayRow.platform};date=${todayIso}`,
      metadata: {
        platform: todayRow.platform,
        todaySessions: todayRow.totalSessions,
        baselineAvgSessions: Number(baselineRow.avgSessions.toFixed(2)),
        liftPercent,
        thresholdMultiplier: env.ALERTS_TRAFFIC_SPIKE_MULTIPLIER,
        configuredThresholdMultiplier: spikeMultiplier,
        dateIso: todayIso,
      },
      deepLinkPath: "/analytics/advanced",
      occurredAtMs: Date.now(),
    });
  }

  return detectedSpikes;
};

interface TopLinkForDateRow {
  linkId: Types.ObjectId;
  engagementScore: number;
  totalSessions: number;
}

const findTopLinkForDate = async (
  userId: string,
  isoDate: string,
): Promise<TopLinkForDateRow | null> => {
  const aggregationPipeline: PipelineStage[] = [
    {
      $match: {
        userId: new Types.ObjectId(userId),
        date: isoDate,
        totalSessions: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: "$linkId",
        engagementScore: { $max: "$engagementScore" },
        totalSessions: { $sum: { $ifNull: ["$totalSessions", 0] } },
      },
    },
    { $sort: { engagementScore: -1, totalSessions: -1 } },
    { $limit: 1 },
  ];

  const aggregationResult = await LinkMetricsDailyModel.aggregate<{
    _id: Types.ObjectId;
    engagementScore: number;
    totalSessions: number;
  }>(aggregationPipeline);

  const topRow = aggregationResult[0];
  if (!topRow) {
    return null;
  }

  return {
    linkId: topRow._id,
    engagementScore: topRow.engagementScore,
    totalSessions: topRow.totalSessions,
  };
};

export const evaluateNewTopLinkForUser = async (
  userId: string,
): Promise<DetectedAlertCandidate | null> => {
  const todayIso = getCurrentUtcDateString();
  const yesterdayIso = getPreviousUtcDateString();

  const [todayTopLink, yesterdayTopLink] = await Promise.all([
    findTopLinkForDate(userId, todayIso),
    findTopLinkForDate(userId, yesterdayIso),
  ]);

  if (!todayTopLink) {
    return null;
  }

  if (todayTopLink.totalSessions < env.ALERTS_MIN_SESSIONS_FOR_SIGNAL) {
    return null;
  }

  if (
    yesterdayTopLink &&
    todayTopLink.linkId.toString() === yesterdayTopLink.linkId.toString()
  ) {
    return null;
  }

  if (
    yesterdayTopLink &&
    todayTopLink.engagementScore <= yesterdayTopLink.engagementScore
  ) {
    return null;
  }

  const linkDocument = await LinkModel.findById(todayTopLink.linkId)
    .select({ shortCode: 1, platform: 1 })
    .lean();

  const shortCode = linkDocument?.shortCode ?? "unknown";
  const platform = linkDocument?.platform ?? null;

  return {
    type: "top_link",
    headline: "New top-performing link detected",
    message: `Your link "${shortCode}" is now your top performer with an engagement score of ${todayTopLink.engagementScore.toFixed(1)}.`,
    metadataKey: `linkId=${todayTopLink.linkId.toString()};date=${todayIso}`,
    metadata: {
      linkId: todayTopLink.linkId.toString(),
      shortCode,
      platform,
      engagementScore: Number(todayTopLink.engagementScore.toFixed(2)),
      previousTopLinkId: yesterdayTopLink?.linkId.toString() ?? null,
      previousEngagementScore: yesterdayTopLink
        ? Number(yesterdayTopLink.engagementScore.toFixed(2))
        : null,
      dateIso: todayIso,
    },
    deepLinkPath: `/links`,
    occurredAtMs: Date.now(),
  };
};

export const evaluateAllAlertCandidatesForUser = async (
  userId: string,
): Promise<DetectedAlertCandidate[]> => {
  const rules = await resolveAlertRuleConfigMap();
  const engagementDropRule = rules.engagement_drop;
  const trafficSpikeRule = rules.traffic_spike;
  const topLinkRule = rules.top_link;

  const engagementDropThresholdRatio =
    engagementDropRule.thresholds.dropPercent !== null
      ? 1 - engagementDropRule.thresholds.dropPercent / 100
      : env.ALERTS_ENGAGEMENT_DROP_THRESHOLD;
  const trafficSpikeMultiplier =
    trafficSpikeRule.thresholds.spikeMultiplier ??
    env.ALERTS_TRAFFIC_SPIKE_MULTIPLIER;

  const [
    engagementDropCandidate,
    trafficSpikeCandidates,
    topLinkCandidate,
  ] = await Promise.all([
    engagementDropRule.enabled
      ? evaluateEngagementDropForUser(userId, engagementDropThresholdRatio)
      : Promise.resolve(null),
    trafficSpikeRule.enabled
      ? evaluateTrafficSpikesForUser(userId, trafficSpikeMultiplier)
      : Promise.resolve([]),
    topLinkRule.enabled
      ? evaluateNewTopLinkForUser(userId)
      : Promise.resolve(null),
  ]);

  const allCandidates: DetectedAlertCandidate[] = [];
  if (engagementDropCandidate) {
    allCandidates.push(engagementDropCandidate);
  }
  allCandidates.push(...trafficSpikeCandidates);
  if (topLinkCandidate) {
    allCandidates.push(topLinkCandidate);
  }

  const dedupedCandidates: DetectedAlertCandidate[] = [];
  for (const candidate of allCandidates) {
    const rule = rules[candidate.type];
    const shouldSkipForCooldown = await hasRecentAlertWithinCooldownWindow({
      userId,
      type: candidate.type,
      cooldownHours: rule.cooldownHours,
    });
    if (!shouldSkipForCooldown) {
      dedupedCandidates.push(candidate);
    }
  }

  return dedupedCandidates;
};

const resolveAlertRuleConfigMap = async (): Promise<Record<AlertType, AlertRuleConfig>> => {
  const persistedRules = await AlertRuleModel.find({})
    .select("type enabled thresholds cooldownHours")
    .lean();

  const defaults: Record<AlertType, AlertRuleConfig> = {
    engagement_drop: {
      enabled: true,
      cooldownHours: env.ALERTS_DEDUP_WINDOW_HOURS,
      thresholds: {
        dropPercent: Number(
          ((1 - env.ALERTS_ENGAGEMENT_DROP_THRESHOLD) * 100).toFixed(2),
        ),
        spikeMultiplier: null,
      },
    },
    traffic_spike: {
      enabled: true,
      cooldownHours: env.ALERTS_DEDUP_WINDOW_HOURS,
      thresholds: {
        dropPercent: null,
        spikeMultiplier: env.ALERTS_TRAFFIC_SPIKE_MULTIPLIER,
      },
    },
    top_link: {
      enabled: true,
      cooldownHours: env.ALERTS_DEDUP_WINDOW_HOURS,
      thresholds: {
        dropPercent: null,
        spikeMultiplier: null,
      },
    },
  };

  for (const persistedRule of persistedRules) {
    defaults[persistedRule.type as AlertType] = {
      enabled: persistedRule.enabled ?? true,
      cooldownHours: persistedRule.cooldownHours ?? env.ALERTS_DEDUP_WINDOW_HOURS,
      thresholds: {
        dropPercent: persistedRule.thresholds?.dropPercent ?? null,
        spikeMultiplier: persistedRule.thresholds?.spikeMultiplier ?? null,
      },
    };
  }

  return defaults;
};

const hasRecentAlertWithinCooldownWindow = async (parameters: {
  userId: string;
  type: AlertType;
  cooldownHours: number;
}): Promise<boolean> => {
  const cooldownWindowStart = new Date(
    Date.now() - parameters.cooldownHours * 60 * 60 * 1000,
  );
  const existingAlertCount = await AlertModel.countDocuments({
    userId: new Types.ObjectId(parameters.userId),
    type: parameters.type,
    createdAt: { $gte: cooldownWindowStart },
  });

  return existingAlertCount > 0;
};
