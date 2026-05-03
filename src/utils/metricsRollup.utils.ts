import {
  ENGAGEMENT_SCROLL_WEIGHT,
  ENGAGEMENT_TIME_WEIGHT,
} from "../api/constants/engagement.js";

export type EngagementMetricsSummary = {
  totalSessions: number;
  bounceSessions: number;
  engagedSessions: number;
  avgDuration: number;
  avgScrollDepth: number;
  bounceRate: number;
  engagementScore: number;
};

export type AggregatedRangeRollupRow = {
  totalSessions: number;
  bounceSessions: number;
  engagedSessions: number;
  totalDuration: number;
  totalScrollDepth: number;
};

export const buildEmptyEngagementMetricsSummary =
  (): EngagementMetricsSummary => ({
    totalSessions: 0,
    bounceSessions: 0,
    engagedSessions: 0,
    avgDuration: 0,
    avgScrollDepth: 0,
    bounceRate: 0,
    engagementScore: 0,
  });

export const computeEngagementMetricsSummaryFromRollup = (
  rollupRow: AggregatedRangeRollupRow | null,
): EngagementMetricsSummary => {
  if (!rollupRow || rollupRow.totalSessions === 0) {
    return buildEmptyEngagementMetricsSummary();
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

export const buildRangeRollupSumStage = () => ({
  totalSessions: { $sum: "$totalSessions" },
  bounceSessions: { $sum: "$bounceSessions" },
  engagedSessions: { $sum: "$engagedSessions" },
  totalDuration: { $sum: "$totalDuration" },
  totalScrollDepth: { $sum: "$totalScrollDepth" },
});

export const buildRangeRollupGroupStage = () => ({
  $group: {
    _id: null,
    ...buildRangeRollupSumStage(),
  },
});
