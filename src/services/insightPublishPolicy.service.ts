import { InsightPublishCursorModel } from "../api/models/insightPublishCursor.model.js";
import { env } from "../config/env.js";

export type InsightPublishPolicyDecision = {
  shouldPublish: boolean;
  reason:
    | "publish_first_time"
    | "publish_content_changed"
    | "publish_force_refresh"
    | "publish_scheduled_slot"
    | "skip_below_min_link_clicks"
    | "skip_daily_publish_cap"
    | "skip_content_unchanged"
    | "skip_content_dedupe_ttl"
    | "skip_min_interval";
};

export type InsightPublishCursorSnapshot = {
  lastPublishedAt: Date;
  lastPublishedContentHash: string;
  publishUtcDayKey?: string;
  publishCountForUtcDay?: number;
};

export type InsightPublishPolicyConfig = {
  minLinkClicks: number;
  maxPerUtcDay: number;
  minIntervalMs: number;
  contentDedupeTtlMs: number;
  forceRefreshMs: number;
};

const elapsedMsSince = (referenceDate: Date, nowMs: number): number =>
  Math.max(0, nowMs - referenceDate.getTime());

export const getUtcDayKey = (nowMs: number): string =>
  new Date(nowMs).toISOString().slice(0, 10);

export const resolvePublishCountForDay = (
  cursor: InsightPublishCursorSnapshot | null,
  todayKey: string,
): number => {
  if (!cursor) {
    return 0;
  }

  if (cursor.publishUtcDayKey !== todayKey) {
    return 0;
  }

  return cursor.publishCountForUtcDay ?? 0;
};

const isForceRefreshEligible = (
  cursor: InsightPublishCursorSnapshot,
  nowMs: number,
  forceRefreshMs: number,
): boolean =>
  forceRefreshMs > 0 &&
  elapsedMsSince(cursor.lastPublishedAt, nowMs) >= forceRefreshMs;

export const evaluateInsightPublishPolicyFromCursor = (input: {
  contentHash: string;
  totalLinkClicks: number;
  nowMs: number;
  cursor: InsightPublishCursorSnapshot | null;
  policy: InsightPublishPolicyConfig;
}): InsightPublishPolicyDecision => {
  if (input.totalLinkClicks < input.policy.minLinkClicks) {
    return {
      shouldPublish: false,
      reason: "skip_below_min_link_clicks",
    };
  }

  const todayKey = getUtcDayKey(input.nowMs);
  const publishCountToday = resolvePublishCountForDay(input.cursor, todayKey);

  if (publishCountToday >= input.policy.maxPerUtcDay) {
    return {
      shouldPublish: false,
      reason: "skip_daily_publish_cap",
    };
  }

  if (!input.cursor) {
    return { shouldPublish: true, reason: "publish_first_time" };
  }

  const elapsed = elapsedMsSince(input.cursor.lastPublishedAt, input.nowMs);
  const contentHashChanged =
    input.contentHash !== input.cursor.lastPublishedContentHash;

  if (contentHashChanged) {
    return { shouldPublish: true, reason: "publish_content_changed" };
  }

  if (isForceRefreshEligible(input.cursor, input.nowMs, input.policy.forceRefreshMs)) {
    return { shouldPublish: true, reason: "publish_force_refresh" };
  }

  if (
    input.policy.contentDedupeTtlMs > 0 &&
    elapsed < input.policy.contentDedupeTtlMs
  ) {
    return { shouldPublish: false, reason: "skip_content_dedupe_ttl" };
  }

  if (
    input.policy.minIntervalMs > 0 &&
    elapsed < input.policy.minIntervalMs
  ) {
    return { shouldPublish: false, reason: "skip_min_interval" };
  }

  if (!contentHashChanged) {
    return { shouldPublish: false, reason: "skip_content_unchanged" };
  }

  return { shouldPublish: true, reason: "publish_scheduled_slot" };
};

const buildPolicyConfigFromEnv = (): InsightPublishPolicyConfig => ({
  minLinkClicks: env.INSIGHTS_PUBLISH_MIN_LINK_CLICKS,
  maxPerUtcDay: env.INSIGHTS_PUBLISH_MAX_PER_UTC_DAY,
  minIntervalMs: env.INSIGHTS_PUBLISH_MIN_INTERVAL_MS,
  contentDedupeTtlMs: env.INSIGHTS_PUBLISH_CONTENT_DEDUPE_TTL_MS,
  forceRefreshMs: env.INSIGHTS_PUBLISH_FORCE_REFRESH_MS,
});

export const evaluateInsightPublishPolicy = async (input: {
  userId: string;
  contentHash: string;
  totalLinkClicks: number;
  nowMs?: number;
}): Promise<InsightPublishPolicyDecision> => {
  const nowMs = input.nowMs ?? Date.now();

  const existingCursor = await InsightPublishCursorModel.findOne({
    userId: input.userId,
  }).lean();

  const cursorSnapshot: InsightPublishCursorSnapshot | null = existingCursor
    ? {
        lastPublishedAt: existingCursor.lastPublishedAt,
        lastPublishedContentHash: existingCursor.lastPublishedContentHash,
        publishUtcDayKey: existingCursor.publishUtcDayKey,
        publishCountForUtcDay: existingCursor.publishCountForUtcDay,
      }
    : null;

  return evaluateInsightPublishPolicyFromCursor({
    contentHash: input.contentHash,
    totalLinkClicks: input.totalLinkClicks,
    nowMs,
    cursor: cursorSnapshot,
    policy: buildPolicyConfigFromEnv(),
  });
};

export const upsertInsightPublishCursor = async (input: {
  userId: string;
  contentHash: string;
  totalLinkClicks: number;
  publishedAt?: Date;
}): Promise<void> => {
  const publishedAt = input.publishedAt ?? new Date();
  const publishUtcDayKey = getUtcDayKey(publishedAt.getTime());

  const existingCursor = await InsightPublishCursorModel.findOne({
    userId: input.userId,
  })
    .select("publishUtcDayKey publishCountForUtcDay")
    .lean();

  const nextPublishCountForUtcDay =
    existingCursor?.publishUtcDayKey === publishUtcDayKey
      ? (existingCursor.publishCountForUtcDay ?? 0) + 1
      : 1;

  await InsightPublishCursorModel.findOneAndUpdate(
    { userId: input.userId },
    {
      $set: {
        lastPublishedAt: publishedAt,
        lastPublishedContentHash: input.contentHash,
        lastTotalLinkClicks: input.totalLinkClicks,
        publishUtcDayKey,
        publishCountForUtcDay: nextPublishCountForUtcDay,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
};
