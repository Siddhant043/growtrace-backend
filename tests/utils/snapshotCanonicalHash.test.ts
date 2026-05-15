import { describe, expect, it } from "vitest";

import type { UserAnalyticsSnapshotPayload } from "../../src/services/insightsSnapshot.service.js";
import {
  computeAnalyticsSnapshotContentHash,
  sumLinkMetricsClicks,
} from "../../src/utils/snapshotCanonicalHash.js";

const baseSnapshot = (): UserAnalyticsSnapshotPayload => ({
  userId: "507f1f77bcf86cd799439011",
  asOfDate: "2026-05-15",
  windowDays: 7,
  platformMetrics: [
    {
      platform: "twitter",
      clicks: 10,
      avgDuration: 12,
      bounceRate: 0.2,
      engagementScore: 8,
    },
    {
      platform: "instagram",
      clicks: 20,
      avgDuration: 15,
      bounceRate: 0.15,
      engagementScore: 9,
    },
  ],
  linkMetrics: [
    {
      linkId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      shortCode: "aaaa",
      clicks: 5,
      avgDuration: 10,
      bounceRate: 0.3,
      engagementScore: 7,
    },
    {
      linkId: "bbbbbbbbbbbbbbbbbbbbbbbb",
      shortCode: "bbbb",
      clicks: 15,
      avgDuration: 11,
      bounceRate: 0.25,
      engagementScore: 8,
    },
  ],
  trendMetrics: [
    { date: "2026-05-13", engagementScore: 70 },
    { date: "2026-05-14", engagementScore: 72 },
  ],
  audienceSnapshot: {
    segmentCounts: {
      total: 100,
      highEngagement: 10,
      lowEngagement: 20,
      returningUsers: 30,
    },
    cohorts: [
      {
        cohortDate: "2026-05-01",
        primaryPlatform: "instagram",
        users: 5,
        returningUsers: 2,
        avgEngagement: 40,
      },
    ],
    topPlatformsByReturningUsers: [
      {
        platform: "twitter",
        returningUsers: 10,
        avgEngagement: 55,
      },
    ],
  },
});

describe("snapshotCanonicalHash", () => {
  it("matches hash when platform row order is permuted", () => {
    const a = baseSnapshot();
    const b = {
      ...a,
      platformMetrics: [a.platformMetrics[1]!, a.platformMetrics[0]!],
    };
    expect(computeAnalyticsSnapshotContentHash(a)).toBe(
      computeAnalyticsSnapshotContentHash(b),
    );
  });

  it("matches hash when link row order is permuted", () => {
    const a = baseSnapshot();
    const b = {
      ...a,
      linkMetrics: [a.linkMetrics[1]!, a.linkMetrics[0]!],
    };
    expect(computeAnalyticsSnapshotContentHash(a)).toBe(
      computeAnalyticsSnapshotContentHash(b),
    );
  });

  it("matches hash when trend row order is permuted", () => {
    const a = baseSnapshot();
    const b = {
      ...a,
      trendMetrics: [a.trendMetrics[1]!, a.trendMetrics[0]!],
    };
    expect(computeAnalyticsSnapshotContentHash(a)).toBe(
      computeAnalyticsSnapshotContentHash(b),
    );
  });

  it("changes hash when a numeric field changes", () => {
    const a = baseSnapshot();
    const b = {
      ...a,
      linkMetrics: a.linkMetrics.map((row, index) =>
        index === 0 ? { ...row, clicks: row.clicks + 1 } : row,
      ),
    };
    expect(computeAnalyticsSnapshotContentHash(a)).not.toBe(
      computeAnalyticsSnapshotContentHash(b),
    );
  });

  it("matches hash when audienceSnapshot is absent vs identical processing", () => {
    const withAudience = baseSnapshot();
    const withoutAudience: UserAnalyticsSnapshotPayload = {
      ...withAudience,
      audienceSnapshot: undefined,
    };
    const withoutAudienceNullish = {
      ...withAudience,
      audienceSnapshot: undefined as undefined,
    };
    expect(computeAnalyticsSnapshotContentHash(withoutAudience)).toBe(
      computeAnalyticsSnapshotContentHash(withoutAudienceNullish),
    );
    expect(computeAnalyticsSnapshotContentHash(withAudience)).not.toBe(
      computeAnalyticsSnapshotContentHash(withoutAudience),
    );
  });

  it("sums link metric clicks", () => {
    expect(sumLinkMetricsClicks({ linkMetrics: baseSnapshot().linkMetrics })).toBe(
      20,
    );
  });
});
