import { Types } from "mongoose";

import { env } from "../config/env.js";
import { LinkMetricsDailyModel } from "../api/models/linkMetricsDaily.model.js";
import { UserModel } from "../api/models/user.model.js";

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AlertEligibilityCheckResult {
  isEligible: boolean;
  reason?: "user_not_found" | "user_in_grace_period" | "insufficient_history";
}

const checkUserOutOfGracePeriod = async (
  userId: string,
): Promise<{ ok: true } | { ok: false; reason: AlertEligibilityCheckResult["reason"] }> => {
  if (!Types.ObjectId.isValid(userId)) {
    return { ok: false, reason: "user_not_found" };
  }

  const userDocument = await UserModel.findById(userId)
    .select({ createdAt: 1, isDeleted: 1 })
    .lean();

  if (!userDocument || userDocument.isDeleted) {
    return { ok: false, reason: "user_not_found" };
  }

  const accountAgeDays = Math.floor(
    (Date.now() - new Date(userDocument.createdAt as Date).getTime()) /
      MILLIS_PER_DAY,
  );

  if (accountAgeDays < env.ALERTS_NEW_USER_GRACE_DAYS) {
    return { ok: false, reason: "user_in_grace_period" };
  }

  return { ok: true };
};

const countDistinctMetricDaysForUser = async (
  userId: string,
  lookbackDays: number,
): Promise<number> => {
  const lookbackStartDate = new Date();
  lookbackStartDate.setUTCDate(lookbackStartDate.getUTCDate() - lookbackDays);
  const lookbackStartIso = lookbackStartDate.toISOString().slice(0, 10);

  const distinctDates = await LinkMetricsDailyModel.distinct("date", {
    userId: new Types.ObjectId(userId),
    date: { $gte: lookbackStartIso },
  });

  return distinctDates.length;
};

/**
 * Determines whether a user qualifies for alert generation right now.
 *
 * Skips:
 *  - Users not found / soft-deleted.
 *  - Users still inside the new-account grace window.
 *  - Users who don't yet have at least 2 distinct days of metric history
 *    (we need both "today" and "yesterday" to compare).
 */
export const checkUserEligibleForAlerts = async (
  userId: string,
): Promise<AlertEligibilityCheckResult> => {
  const userCheckResult = await checkUserOutOfGracePeriod(userId);
  if (!userCheckResult.ok) {
    return { isEligible: false, reason: userCheckResult.reason };
  }

  const distinctMetricDayCount = await countDistinctMetricDaysForUser(
    userId,
    env.ALERTS_DETECTION_ACTIVE_WINDOW_DAYS,
  );

  if (distinctMetricDayCount < 2) {
    return { isEligible: false, reason: "insufficient_history" };
  }

  return { isEligible: true };
};
