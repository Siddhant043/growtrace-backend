import {
  ANALYTICS_INSIGHTS_ROUTING_KEY,
  publishToAnalyticsExchange,
} from "../infrastructure/rabbitmq";
import {
  buildUserAnalyticsSnapshot,
  findActiveUserIdsForDate,
} from "./insightsSnapshot.service";

const SNAPSHOT_WINDOW_DAYS_DEFAULT = 7;

export const publishUserAnalyticsSnapshot = async (
  userId: string,
  asOfDateIso: string,
  windowDays: number = SNAPSHOT_WINDOW_DAYS_DEFAULT,
): Promise<void> => {
  const snapshotPayload = await buildUserAnalyticsSnapshot(
    userId,
    asOfDateIso,
    windowDays,
  );

  if (
    snapshotPayload.platformMetrics.length === 0 &&
    snapshotPayload.linkMetrics.length === 0 &&
    snapshotPayload.trendMetrics.length === 0
  ) {
    console.info(
      "[insightsPublisher] empty snapshot for user; skipping publish",
      { userId, asOfDateIso },
    );
    return;
  }

  await publishToAnalyticsExchange(ANALYTICS_INSIGHTS_ROUTING_KEY, {
    ...snapshotPayload,
  });
};

type PublishSnapshotsForActiveUsersResult = {
  attemptedUserCount: number;
  publishedUserCount: number;
  failedUserCount: number;
};

export const publishSnapshotsForActiveUsers = async (
  asOfDateIso: string,
  windowDays: number = SNAPSHOT_WINDOW_DAYS_DEFAULT,
): Promise<PublishSnapshotsForActiveUsersResult> => {
  const activeUserIds = await findActiveUserIdsForDate(asOfDateIso);

  if (activeUserIds.length === 0) {
    return {
      attemptedUserCount: 0,
      publishedUserCount: 0,
      failedUserCount: 0,
    };
  }

  let publishedUserCount = 0;
  let failedUserCount = 0;

  for (const activeUserId of activeUserIds) {
    try {
      await publishUserAnalyticsSnapshot(
        activeUserId,
        asOfDateIso,
        windowDays,
      );
      publishedUserCount += 1;
    } catch (publishError) {
      failedUserCount += 1;
      console.error(
        "[insightsPublisher] Failed to publish snapshot for user",
        {
          userId: activeUserId,
          error:
            publishError instanceof Error
              ? publishError.message
              : String(publishError),
        },
      );
    }
  }

  return {
    attemptedUserCount: activeUserIds.length,
    publishedUserCount,
    failedUserCount,
  };
};
