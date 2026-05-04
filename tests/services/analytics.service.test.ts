import { describe, expect, it, vi, afterEach } from "vitest";

import { ClickEventModel } from "../../src/api/models/clickEvent.model.js";
import { LinkModel } from "../../src/api/models/link.model.js";
import {
  compareAnalyticsByPlatform,
  getClickTrends,
  getOverview,
  getPlatformStats,
  getTopLinks,
} from "../../src/services/analytics.service.js";

describe("analytics.service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds percentages to platform stats", async () => {
    vi.spyOn(ClickEventModel, "countDocuments").mockResolvedValueOnce(100);
    vi.spyOn(ClickEventModel, "aggregate").mockResolvedValueOnce([
      { platform: "instagram", clicks: 70 },
      { platform: "twitter", clicks: 30 },
    ]);

    const stats = await getPlatformStats("507f1f77bcf86cd799439011");

    expect(stats).toEqual([
      { platform: "instagram", clicks: 70, percentage: 70 },
      { platform: "twitter", clicks: 30, percentage: 30 },
    ]);
  });

  it("adds platform and percentage to top links", async () => {
    vi.spyOn(ClickEventModel, "countDocuments").mockResolvedValueOnce(200);
    vi.spyOn(ClickEventModel, "aggregate").mockResolvedValueOnce([
      {
        linkId: "507f1f77bcf86cd799439012",
        shortCode: "abc123",
        originalUrl: "https://example.com/a",
        platform: "instagram",
        clicks: 80,
      },
    ]);

    const topLinks = await getTopLinks("507f1f77bcf86cd799439011");

    expect(topLinks).toEqual([
      {
        linkId: "507f1f77bcf86cd799439012",
        shortCode: "abc123",
        originalUrl: "https://example.com/a",
        platform: "instagram",
        clicks: 80,
        percentage: 40,
      },
    ]);
  });

  it("extends overview with active links and avg clicks per link", async () => {
    vi.spyOn(ClickEventModel, "countDocuments")
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(120);
    vi.spyOn(LinkModel, "countDocuments").mockResolvedValueOnce(6);
    vi.spyOn(ClickEventModel, "aggregate")
      .mockResolvedValueOnce([{ platform: "instagram", clicks: 90 }])
      .mockResolvedValueOnce([
        {
          linkId: "507f1f77bcf86cd799439012",
          shortCode: "abc123",
          originalUrl: "https://example.com/a",
          platform: "instagram",
          clicks: 40,
        },
      ]);

    const overview = await getOverview("507f1f77bcf86cd799439011");

    expect(overview.totalClicks).toBe(120);
    expect(overview.activeLinks).toBe(6);
    expect(overview.avgClicksPerLink).toBe(20);
    expect(overview.topPlatform?.percentage).toBe(75);
    expect(overview.topLink?.percentage).toBe(33);
  });

  it("builds trends grouped by day for supported range", async () => {
    const aggregateSpy = vi.spyOn(ClickEventModel, "aggregate").mockResolvedValueOnce([
      { date: "2026-04-20", clicks: 120 },
      { date: "2026-04-21", clicks: 180 },
    ]);

    const trends = await getClickTrends("507f1f77bcf86cd799439011", "7d");

    expect(trends).toEqual([
      { date: "2026-04-20", clicks: 120 },
      { date: "2026-04-21", clicks: 180 },
    ]);

    const aggregatePipeline = aggregateSpy.mock.calls[0]?.[0];
    expect(aggregatePipeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          $group: expect.objectContaining({
            _id: expect.objectContaining({
              $dateToString: expect.objectContaining({ format: "%Y-%m-%d" }),
            }),
          }),
        }),
      ]),
    );
  });

  it("returns platform comparison payload", async () => {
    vi.spyOn(ClickEventModel, "aggregate").mockResolvedValueOnce([
      { platform: "instagram", clicks: 86 },
      { platform: "twitter", clicks: 24 },
    ]);

    const comparison = await compareAnalyticsByPlatform("507f1f77bcf86cd799439011");

    expect(comparison).toEqual({
      instagram: { clicks: 86 },
      twitter: { clicks: 24 },
    });
  });
});
