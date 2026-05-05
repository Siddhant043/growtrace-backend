import {
  ANALYTICS_INSIGHTS_ROUTING_KEY,
  publishToAnalyticsExchange,
} from "../infrastructure/rabbitmq.js";
import { InsightJobModel } from "../api/models/insightJob.model.js";
import {
  buildUserAnalyticsSnapshot,
  findActiveUserIdsForDate,
} from "./insightsSnapshot.service.js";
import { randomUUID } from "node:crypto";

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

  const audienceSnapshot = snapshotPayload.audienceSnapshot;
  const hasAudienceSignal =
    !!audienceSnapshot &&
    (audienceSnapshot.segmentCounts.total > 0 ||
      audienceSnapshot.cohorts.length > 0 ||
      audienceSnapshot.topPlatformsByReturningUsers.length > 0);

  if (
    snapshotPayload.platformMetrics.length === 0 &&
    snapshotPayload.linkMetrics.length === 0 &&
    snapshotPayload.trendMetrics.length === 0 &&
    !hasAudienceSignal
  ) {
    console.info(
      "[insightsPublisher] empty snapshot for user; skipping publish",
      { userId, asOfDateIso },
    );
    return;
  }

  const insightJobId = randomUUID();
  const publishStartedAtMs = Date.now();

  await InsightJobModel.create({
    userId,
    jobId: insightJobId,
    status: "pending",
    payload: snapshotPayload,
    retryCount: 0,
  });

  try {
    await publishToAnalyticsExchange(
      ANALYTICS_INSIGHTS_ROUTING_KEY,
      {
        ...snapshotPayload,
        jobId: insightJobId,
      },
      { messageId: insightJobId },
    );
  } catch (publishError) {
    await InsightJobModel.updateOne(
      { jobId: insightJobId },
      {
        $set: {
          status: "failed",
          processingDurationMs: Date.now() - publishStartedAtMs,
          error: {
            message:
              publishError instanceof Error
                ? publishError.message
                : String(publishError),
            stack: publishError instanceof Error ? publishError.stack ?? null : null,
          },
        },
      },
    );
    throw publishError;
  }
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
