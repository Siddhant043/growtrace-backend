import { InsightPublishCursorModel } from "../api/models/insightPublishCursor.model.js";
import { env } from "../config/env.js";

export type InsightPublishPolicyDecision = {
  shouldPublish: boolean;
  reason:
    | "publish_first_time"
    | "publish_content_changed"
    | "publish_force_refresh"
    | "publish_throttle_passed"
    | "skip_below_min_link_clicks"
    | "skip_content_dedupe_ttl"
    | "skip_min_interval";
};

const elapsedMsSince = (referenceDate: Date, nowMs: number): number =>
  Math.max(0, nowMs - referenceDate.getTime());

export const evaluateInsightPublishPolicy = async (input: {
  userId: string;
  contentHash: string;
  totalLinkClicks: number;
  nowMs?: number;
}): Promise<InsightPublishPolicyDecision> => {
  const nowMs = input.nowMs ?? Date.now();

  if (input.totalLinkClicks < env.INSIGHTS_PUBLISH_MIN_LINK_CLICKS) {
    return {
      shouldPublish: false,
      reason: "skip_below_min_link_clicks",
    };
  }

  const existingCursor = await InsightPublishCursorModel.findOne({
    userId: input.userId,
  }).lean();

  if (!existingCursor) {
    return { shouldPublish: true, reason: "publish_first_time" };
  }

  if (input.contentHash !== existingCursor.lastPublishedContentHash) {
    return { shouldPublish: true, reason: "publish_content_changed" };
  }

  const elapsed = elapsedMsSince(existingCursor.lastPublishedAt, nowMs);

  if (
    env.INSIGHTS_PUBLISH_FORCE_REFRESH_MS > 0 &&
    elapsed >= env.INSIGHTS_PUBLISH_FORCE_REFRESH_MS
  ) {
    return { shouldPublish: true, reason: "publish_force_refresh" };
  }

  if (
    env.INSIGHTS_PUBLISH_CONTENT_DEDUPE_TTL_MS > 0 &&
    elapsed < env.INSIGHTS_PUBLISH_CONTENT_DEDUPE_TTL_MS
  ) {
    return { shouldPublish: false, reason: "skip_content_dedupe_ttl" };
  }

  if (
    env.INSIGHTS_PUBLISH_MIN_INTERVAL_MS > 0 &&
    elapsed < env.INSIGHTS_PUBLISH_MIN_INTERVAL_MS
  ) {
    return { shouldPublish: false, reason: "skip_min_interval" };
  }

  return { shouldPublish: true, reason: "publish_throttle_passed" };
};

export const upsertInsightPublishCursor = async (input: {
  userId: string;
  contentHash: string;
  totalLinkClicks: number;
  publishedAt?: Date;
}): Promise<void> => {
  const publishedAt = input.publishedAt ?? new Date();

  await InsightPublishCursorModel.findOneAndUpdate(
    { userId: input.userId },
    {
      $set: {
        lastPublishedAt: publishedAt,
        lastPublishedContentHash: input.contentHash,
        lastTotalLinkClicks: input.totalLinkClicks,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
};
