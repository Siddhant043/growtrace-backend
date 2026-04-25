import { afterEach, describe, expect, it, vi } from "vitest";

import { ClickEventModel } from "../../src/api/models/clickEvent.model";
import { LinkModel } from "../../src/api/models/link.model";
import { getDashboardPayload } from "../../src/services/dashboard.service";

describe("dashboard.service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns combined dashboard payload with quick insight", async () => {
    vi.spyOn(ClickEventModel, "countDocuments").mockResolvedValueOnce(1000);
    vi.spyOn(LinkModel, "countDocuments").mockResolvedValueOnce(12);
    vi.spyOn(ClickEventModel, "aggregate")
      .mockResolvedValueOnce([
        { platform: "instagram", clicks: 690 },
        { platform: "twitter", clicks: 190 },
        { platform: "youtube", clicks: 120 },
      ])
      .mockResolvedValueOnce([
        {
          linkId: "507f1f77bcf86cd799439012",
          shortCode: "abc123",
          clicks: 210,
        },
        {
          linkId: "507f1f77bcf86cd799439013",
          shortCode: "xyz789",
          clicks: 180,
        },
      ])
      .mockResolvedValueOnce([
        { shortCode: "abc123", clicks: 1, timestamp: new Date("2026-04-25T10:00:00.000Z") },
      ]);
    vi.spyOn(LinkModel, "aggregate").mockResolvedValueOnce([
      { shortCode: "new555", createdAt: new Date("2026-04-25T11:00:00.000Z") },
    ]);

    const payload = await getDashboardPayload("507f1f77bcf86cd799439011");

    expect(payload.totalClicks).toBe(1000);
    expect(payload.activeLinks).toBe(12);
    expect(payload.topPlatform).toEqual({
      platform: "instagram",
      clicks: 690,
      percentage: 69,
    });
    expect(payload.topLink).toEqual({
      shortCode: "abc123",
      clicks: 210,
    });
    expect(payload.platformSnapshot).toHaveLength(3);
    expect(payload.topLinksPreview).toHaveLength(2);
    expect(payload.recentActivity).toHaveLength(2);
    expect(payload.recentActivity[0]?.type).toBe("link_created");
    expect(payload.quickInsight).toBe("Instagram is driving most of your traffic this week");
  });
});
