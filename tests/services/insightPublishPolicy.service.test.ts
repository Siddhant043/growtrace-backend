import { afterEach, describe, expect, it, vi } from "vitest";

import { InsightPublishCursorModel } from "../../src/api/models/insightPublishCursor.model.js";
import {
  evaluateInsightPublishPolicy,
  evaluateInsightPublishPolicyFromCursor,
  getUtcDayKey,
  resolvePublishCountForDay,
  type InsightPublishCursorSnapshot,
  type InsightPublishPolicyConfig,
} from "../../src/services/insightPublishPolicy.service.js";

const TWELVE_HOURS_MS = 43_200_000;
const ONE_DAY_MS = 86_400_000;

const defaultPolicy: InsightPublishPolicyConfig = {
  minLinkClicks: 0,
  maxPerUtcDay: 2,
  minIntervalMs: TWELVE_HOURS_MS,
  contentDedupeTtlMs: TWELVE_HOURS_MS,
  forceRefreshMs: ONE_DAY_MS,
};

const buildCursor = (
  overrides: Partial<InsightPublishCursorSnapshot> & {
    lastPublishedAt: Date;
    lastPublishedContentHash: string;
  },
): InsightPublishCursorSnapshot => ({
  publishUtcDayKey: "2026-05-23",
  publishCountForUtcDay: 1,
  ...overrides,
});

describe("insightPublishPolicy pure helpers", () => {
  it("getUtcDayKey returns UTC calendar date", () => {
    const dayKey = getUtcDayKey(Date.parse("2026-05-23T21:30:00.000Z"));
    expect(dayKey).toBe("2026-05-23");
  });

  it("resolvePublishCountForDay resets when day key differs", () => {
    const cursor = buildCursor({
      lastPublishedAt: new Date("2026-05-22T09:00:00.000Z"),
      lastPublishedContentHash: "hash-a",
      publishUtcDayKey: "2026-05-22",
      publishCountForUtcDay: 2,
    });

    expect(resolvePublishCountForDay(cursor, "2026-05-23")).toBe(0);
    expect(resolvePublishCountForDay(cursor, "2026-05-22")).toBe(2);
  });
});

describe("evaluateInsightPublishPolicyFromCursor", () => {
  const nowMs = Date.parse("2026-05-23T21:00:00.000Z");

  it("allows first publish when no cursor exists", () => {
    const decision = evaluateInsightPublishPolicyFromCursor({
      contentHash: "hash-a",
      totalLinkClicks: 10,
      nowMs,
      cursor: null,
      policy: defaultPolicy,
    });

    expect(decision).toEqual({
      shouldPublish: true,
      reason: "publish_first_time",
    });
  });

  it("allows second publish on same UTC day when content hash changes", () => {
    const decision = evaluateInsightPublishPolicyFromCursor({
      contentHash: "hash-b",
      totalLinkClicks: 10,
      nowMs,
      cursor: buildCursor({
        lastPublishedAt: new Date("2026-05-23T09:00:00.000Z"),
        lastPublishedContentHash: "hash-a",
        publishUtcDayKey: "2026-05-23",
        publishCountForUtcDay: 1,
      }),
      policy: defaultPolicy,
    });

    expect(decision).toEqual({
      shouldPublish: true,
      reason: "publish_content_changed",
    });
  });

  it("blocks third publish on same UTC day with skip_daily_publish_cap", () => {
    const decision = evaluateInsightPublishPolicyFromCursor({
      contentHash: "hash-c",
      totalLinkClicks: 10,
      nowMs,
      cursor: buildCursor({
        lastPublishedAt: new Date("2026-05-23T09:00:00.000Z"),
        lastPublishedContentHash: "hash-b",
        publishUtcDayKey: "2026-05-23",
        publishCountForUtcDay: 2,
      }),
      policy: defaultPolicy,
    });

    expect(decision).toEqual({
      shouldPublish: false,
      reason: "skip_daily_publish_cap",
    });
  });

  it("allows publish on a new UTC day after counter reset", () => {
    const decision = evaluateInsightPublishPolicyFromCursor({
      contentHash: "hash-d",
      totalLinkClicks: 10,
      nowMs,
      cursor: buildCursor({
        lastPublishedAt: new Date("2026-05-22T21:00:00.000Z"),
        lastPublishedContentHash: "hash-c",
        publishUtcDayKey: "2026-05-22",
        publishCountForUtcDay: 2,
      }),
      policy: defaultPolicy,
    });

    expect(decision).toEqual({
      shouldPublish: true,
      reason: "publish_content_changed",
    });
  });

  it("blocks same-hash republish within dedupe TTL", () => {
    const decision = evaluateInsightPublishPolicyFromCursor({
      contentHash: "hash-a",
      totalLinkClicks: 10,
      nowMs,
      cursor: buildCursor({
        lastPublishedAt: new Date(nowMs - 60 * 60 * 1000),
        lastPublishedContentHash: "hash-a",
        publishUtcDayKey: "2026-05-23",
        publishCountForUtcDay: 1,
      }),
      policy: defaultPolicy,
    });

    expect(decision).toEqual({
      shouldPublish: false,
      reason: "skip_content_dedupe_ttl",
    });
  });

  it("does not allow content-changed publish when daily cap is reached", () => {
    const decision = evaluateInsightPublishPolicyFromCursor({
      contentHash: "hash-new",
      totalLinkClicks: 10,
      nowMs,
      cursor: buildCursor({
        lastPublishedAt: new Date("2026-05-23T09:00:00.000Z"),
        lastPublishedContentHash: "hash-old",
        publishUtcDayKey: "2026-05-23",
        publishCountForUtcDay: 2,
      }),
      policy: defaultPolicy,
    });

    expect(decision).toEqual({
      shouldPublish: false,
      reason: "skip_daily_publish_cap",
    });
  });
});

describe("evaluateInsightPublishPolicy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads cursor from Mongo and applies policy", async () => {
    vi.spyOn(InsightPublishCursorModel, "findOne").mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        lastPublishedAt: new Date("2026-05-23T09:00:00.000Z"),
        lastPublishedContentHash: "hash-a",
        publishUtcDayKey: "2026-05-23",
        publishCountForUtcDay: 2,
      }),
    } as never);

    const decision = await evaluateInsightPublishPolicy({
      userId: "user-1",
      contentHash: "hash-b",
      totalLinkClicks: 5,
      nowMs: Date.parse("2026-05-23T21:00:00.000Z"),
    });

    expect(decision.reason).toBe("skip_daily_publish_cap");
  });
});
