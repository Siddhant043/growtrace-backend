import { env } from "../config/env.js";

export const HIGH_ENGAGEMENT_SCORE_MIN = env.AUDIENCE_HIGH_ENGAGEMENT_SCORE_MIN;
export const LOW_ENGAGEMENT_SCORE_MAX = env.AUDIENCE_LOW_ENGAGEMENT_SCORE_MAX;

export const isHighEngagementScore = (engagementScore: number): boolean =>
  engagementScore >= HIGH_ENGAGEMENT_SCORE_MIN;

export const isLowEngagementScore = (engagementScore: number): boolean =>
  engagementScore <= LOW_ENGAGEMENT_SCORE_MAX;

export type AudienceSegmentLabel =
  | "highEngagement"
  | "lowEngagement"
  | "midEngagement"
  | "returning";

export const classifyEngagementSegment = (
  engagementScore: number,
): "highEngagement" | "lowEngagement" | "midEngagement" => {
  if (isHighEngagementScore(engagementScore)) {
    return "highEngagement";
  }

  if (isLowEngagementScore(engagementScore)) {
    return "lowEngagement";
  }

  return "midEngagement";
};

export interface AudienceEngagementThresholds {
  highEngagementScoreMin: number;
  lowEngagementScoreMax: number;
}

export const getAudienceEngagementThresholds =
  (): AudienceEngagementThresholds => ({
    highEngagementScoreMin: HIGH_ENGAGEMENT_SCORE_MIN,
    lowEngagementScoreMax: LOW_ENGAGEMENT_SCORE_MAX,
  });
