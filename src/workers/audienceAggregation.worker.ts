import type { Job, Worker } from "bullmq";

import {
  createAudienceAggregationWorker,
  enqueuePerUserAlertsDetectionJob,
  type AudienceAggregationJobPayload,
} from "../infrastructure/queue";
import {
  listActiveUserIdsInAggregationWindow,
  runAudienceUserAggregationForUser,
} from "../services/audienceUserAggregation.service";
import { runAudienceCohortAggregationForUser } from "../services/audienceCohortAggregation.service";
import { publishUserAnalyticsSnapshot } from "../services/insightsPublisher.service";
import { getCurrentUtcDateString } from "../utils/dateBounds.utils";

interface AudienceAggregationRunSummary {
  attemptedUserCount: number;
  succeededUserCount: number;
  failedUserCount: number;
  totalUsersAggregatedRowsUpserted: number;
  totalCohortRowsUpserted: number;
  durationMs: number;
}

const aggregateAudienceForSingleUser = async (
  activeUserId: string,
): Promise<{
  usersAggregatedRowsUpserted: number;
  cohortRowsUpserted: number;
}> => {
  const usersAggregatedRowsUpserted =
    await runAudienceUserAggregationForUser(activeUserId);
  const cohortRowsUpserted =
    await runAudienceCohortAggregationForUser(activeUserId);

  return { usersAggregatedRowsUpserted, cohortRowsUpserted };
};

const fireAndForgetSnapshotPublishForUser = async (
  activeUserId: string,
): Promise<void> => {
  try {
    await publishUserAnalyticsSnapshot(activeUserId, getCurrentUtcDateString());
  } catch (snapshotPublishError) {
    console.error(
      "[audienceAggregation.worker] snapshot publish failed (non-fatal)",
      {
        userId: activeUserId,
        error:
          snapshotPublishError instanceof Error
            ? snapshotPublishError.message
            : String(snapshotPublishError),
      },
    );
  }
};

const fireAndForgetAlertDetectionEnqueueForUser = async (
  activeUserId: string,
): Promise<void> => {
  try {
    await enqueuePerUserAlertsDetectionJob(activeUserId, "post-audience");
  } catch (enqueueError) {
    console.error(
      "[audienceAggregation.worker] alerts detection enqueue failed (non-fatal)",
      {
        userId: activeUserId,
        error:
          enqueueError instanceof Error
            ? enqueueError.message
            : String(enqueueError),
      },
    );
  }
};

export const processAudienceAggregationJob = async (
  job: Job<AudienceAggregationJobPayload>,
): Promise<AudienceAggregationRunSummary> => {
  const aggregationStartedAt = Date.now();
  const activeUserIds = await listActiveUserIdsInAggregationWindow();

  let succeededUserCount = 0;
  let failedUserCount = 0;
  let totalUsersAggregatedRowsUpserted = 0;
  let totalCohortRowsUpserted = 0;

  for (const activeUserId of activeUserIds) {
    try {
      const { usersAggregatedRowsUpserted, cohortRowsUpserted } =
        await aggregateAudienceForSingleUser(activeUserId);

      totalUsersAggregatedRowsUpserted += usersAggregatedRowsUpserted;
      totalCohortRowsUpserted += cohortRowsUpserted;
      succeededUserCount += 1;

      void fireAndForgetSnapshotPublishForUser(activeUserId);
      void fireAndForgetAlertDetectionEnqueueForUser(activeUserId);
    } catch (perUserError) {
      failedUserCount += 1;
      console.error("[audienceAggregation.worker] per-user aggregation failed", {
        userId: activeUserId,
        error:
          perUserError instanceof Error
            ? perUserError.message
            : String(perUserError),
      });
    }
  }

  const summary: AudienceAggregationRunSummary = {
    attemptedUserCount: activeUserIds.length,
    succeededUserCount,
    failedUserCount,
    totalUsersAggregatedRowsUpserted,
    totalCohortRowsUpserted,
    durationMs: Date.now() - aggregationStartedAt,
  };

  console.info(
    `[audienceAggregation.worker] schedulerId=${job.data.schedulerId} ` +
      `attemptedUsers=${summary.attemptedUserCount} ` +
      `succeededUsers=${summary.succeededUserCount} ` +
      `failedUsers=${summary.failedUserCount} ` +
      `usersAggregatedRows=${summary.totalUsersAggregatedRowsUpserted} ` +
      `cohortRows=${summary.totalCohortRowsUpserted} ` +
      `durationMs=${summary.durationMs}`,
  );

  return summary;
};

export const startAudienceAggregationWorker =
  (): Worker<AudienceAggregationJobPayload> => {
    const worker = createAudienceAggregationWorker(
      processAudienceAggregationJob,
    );

    worker.on("failed", (failedJob, failureError) => {
      console.error("[audienceAggregation.worker] Job failed", {
        jobId: failedJob?.id,
        attemptsMade: failedJob?.attemptsMade,
        error: failureError,
      });
    });

    worker.on("error", (workerError) => {
      console.error("[audienceAggregation.worker] Worker error", workerError);
    });

    return worker;
  };
