/**
 * Canonical serialization for analytics snapshots so identical semantic data
 * yields the same hash regardless of array ordering from Mongo aggregations.
 */

import { createHash } from "node:crypto";

import type { UserAnalyticsSnapshotPayload } from "../services/insightsSnapshot.service.js";

type SortableRecord = Record<string, unknown>;

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as SortableRecord;
  const sortedKeys = Object.keys(record).sort((a, b) => a.localeCompare(b));
  const pairs = sortedKeys
    .filter((key) => record[key] !== undefined)
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringify(record[key] as unknown)}`,
    );
  return `{${pairs.join(",")}}`;
};

export const sumLinkMetricsClicks = (
  payload: Pick<UserAnalyticsSnapshotPayload, "linkMetrics">,
): number =>
  payload.linkMetrics.reduce(
    (total, row) => total + Number(row.clicks ?? 0),
    0,
  );

const buildCanonicalSnapshotForHash = (
  payload: UserAnalyticsSnapshotPayload,
): SortableRecord => {
  const sortedPlatforms = [...payload.platformMetrics].sort((a, b) =>
    a.platform.localeCompare(b.platform),
  );

  const sortedLinks = [...payload.linkMetrics].sort((a, b) =>
    a.linkId.localeCompare(b.linkId),
  );

  const sortedTrends = [...payload.trendMetrics].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  let audience: SortableRecord | null = null;
  if (payload.audienceSnapshot) {
    const cohorts = [...payload.audienceSnapshot.cohorts].sort((a, b) => {
      const byDate = a.cohortDate.localeCompare(b.cohortDate);
      if (byDate !== 0) return byDate;
      return a.primaryPlatform.localeCompare(b.primaryPlatform);
    });
    const topPlatforms = [
      ...payload.audienceSnapshot.topPlatformsByReturningUsers,
    ].sort((a, b) => a.platform.localeCompare(b.platform));

    audience = {
      segmentCounts: payload.audienceSnapshot.segmentCounts,
      cohorts,
      topPlatformsByReturningUsers: topPlatforms,
    };
  }

  return {
    userId: payload.userId,
    asOfDate: payload.asOfDate,
    windowDays: payload.windowDays,
    platformMetrics: sortedPlatforms,
    linkMetrics: sortedLinks,
    trendMetrics: sortedTrends,
    audienceSnapshot: audience,
  };
};

/**
 * SHA-256 hex digest of the canonical snapshot (aligned with insights-ms
 * analytics payload fields used for LLM input).
 */
export const computeAnalyticsSnapshotContentHash = (
  payload: UserAnalyticsSnapshotPayload,
): string => {
  const canonical = buildCanonicalSnapshotForHash(payload);
  return createHash("sha256")
    .update(stableStringify(canonical), "utf8")
    .digest("hex");
};
