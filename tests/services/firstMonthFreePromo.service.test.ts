import { afterEach, describe, expect, it, vi } from "vitest";

import { SubscriptionModel } from "../../src/api/models/subscription.model.js";
import { UserModel } from "../../src/api/models/user.model.js";
import {
  computeTrialStartAtUnix,
  isEligibleForFirstMonthFree,
  trialEndsAtFromStartAtUnix,
} from "../../src/services/firstMonthFreePromo.service.js";

vi.mock("../../src/config/env.js", () => ({
  env: {
    PRO_FIRST_MONTH_FREE_ENABLED: true,
    PRO_FIRST_MONTH_FREE_DAYS: 30,
  },
}));

describe("firstMonthFreePromo.service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("computeTrialStartAtUnix returns a future timestamp with lead time buffer", () => {
    const referenceDate = new Date("2026-05-01T12:00:00.000Z");
    const startAtUnix = computeTrialStartAtUnix(30, referenceDate);
    const minimumUnix = Math.floor(referenceDate.getTime() / 1000) + 5 * 60;

    expect(startAtUnix).toBeGreaterThanOrEqual(minimumUnix);
    expect(trialEndsAtFromStartAtUnix(startAtUnix).getUTCMonth()).toBe(4);
  });

  it("returns false for lifetime subscribers", async () => {
    vi.spyOn(UserModel, "findById").mockReturnValue({
      select: () => ({
        lean: async () => ({
          isLifetimeSubscription: true,
          isDeleted: false,
        }),
      }),
    } as never);

    await expect(
      isEligibleForFirstMonthFree("507f1f77bcf86cd799439011"),
    ).resolves.toBe(false);
  });

  it("returns false when user had a prior paid subscription", async () => {
    vi.spyOn(UserModel, "findById").mockReturnValue({
      select: () => ({
        lean: async () => ({
          isLifetimeSubscription: false,
          isDeleted: false,
        }),
      }),
    } as never);
    vi.spyOn(SubscriptionModel, "findOne").mockReturnValue({
      select: () => ({
        lean: async () => ({ _id: "prior-sub" }),
      }),
    } as never);

    await expect(
      isEligibleForFirstMonthFree("507f1f77bcf86cd799439011"),
    ).resolves.toBe(false);
  });

  it("returns true for a new user with no paid history", async () => {
    vi.spyOn(UserModel, "findById").mockReturnValue({
      select: () => ({
        lean: async () => ({
          isLifetimeSubscription: false,
          isDeleted: false,
        }),
      }),
    } as never);
    vi.spyOn(SubscriptionModel, "findOne").mockReturnValue({
      select: () => ({
        lean: async () => null,
      }),
    } as never);

    await expect(
      isEligibleForFirstMonthFree("507f1f77bcf86cd799439011"),
    ).resolves.toBe(true);
  });
});
