import type { Job, Worker } from "bullmq";
import { Types } from "mongoose";

import { LinkMetricsDailyModel } from "../api/models/linkMetricsDaily.model.js";
import {
  createMetricsAggregationWorker,
  enqueuePerUserAlertsDetectionJob,
  METRICS_AGGREGATION_SCHEDULER_IDS,
  type MetricsAggregationJobPayload,
} from "../infrastructure/queue.js";
import { publishSnapshotsForActiveUsers } from "../services/insightsPublisher.service.js";
import {
  aggregateAllScopesForDate,
  getCurrentUtcDateString,
  getPreviousUtcDateString,
} from "../services/metricsAggregation.service.js";

const resolveTargetDateForJob = (
  jobPayload: MetricsAggregationJobPayload,
): string => {
  if (
    jobPayload.schedulerId === METRICS_AGGREGATION_SCHEDULER_IDS.previousUtcDay
  ) {
    return getPreviousUtcDateString();
  }

  return getCurrentUtcDateString();
};

export const processMetricsAggregationJob = async (
  job: Job<MetricsAggregationJobPayload>,
): Promise<void> => {
  const targetDate = resolveTargetDateForJob(job.data);

  const aggregationStartedAt = Date.now();
  const aggregationSummary = await aggregateAllScopesForDate(targetDate);
  const aggregationDurationMs = Date.now() - aggregationStartedAt;

  console.info(
    `[metricsAggregation.worker] schedulerId=${job.data.schedulerId} ` +
      `date=${aggregationSummary.date} ` +
      `linkRows=${aggregationSummary.linkRowsUpserted} ` +
      `platformRows=${aggregationSummary.platformRowsUpserted} ` +
      `campaignRows=${aggregationSummary.campaignRowsUpserted} ` +
      `durationMs=${aggregationDurationMs}`,
  );

  // Fire-and-forget: failures here must not fail the aggregation job. Each
  // per-user publish wraps its own error inside `publishSnapshotsForActiveUsers`.
  try {
    const insightsPublishStartedAt = Date.now();
    const insightsPublishSummary =
      await publishSnapshotsForActiveUsers(targetDate);
    const insightsPublishDurationMs = Date.now() - insightsPublishStartedAt;

    console.info(
      `[metricsAggregation.worker] insightsPublish ` +
        `attempted=${insightsPublishSummary.attemptedUserCount} ` +
        `published=${insightsPublishSummary.publishedUserCount} ` +
        `failed=${insightsPublishSummary.failedUserCount} ` +
        `durationMs=${insightsPublishDurationMs}`,
    );
  } catch (insightsPublishError) {
    console.error(
      "[metricsAggregation.worker] insightsPublish bulk error (non-fatal)",
      {
        date: targetDate,
        error:
          insightsPublishError instanceof Error
            ? insightsPublishError.message
            : String(insightsPublishError),
      },
    );
  }

  try {
    await enqueueAlertDetectionForActiveUsersOnDate(targetDate);
  } catch (alertEnqueueError) {
    console.error(
      "[metricsAggregation.worker] alerts detection enqueue error (non-fatal)",
      {
        date: targetDate,
        error:
          alertEnqueueError instanceof Error
            ? alertEnqueueError.message
            : String(alertEnqueueError),
      },
    );
  }
};

const enqueueAlertDetectionForActiveUsersOnDate = async (
  targetDate: string,
): Promise<void> => {
  const distinctActiveUserIds = await LinkMetricsDailyModel.distinct("userId", {
    date: targetDate,
  });

  if (distinctActiveUserIds.length === 0) {
    return;
  }

  await Promise.all(
    distinctActiveUserIds.map((rawUserId) => {
      const normalizedUserId =
        rawUserId instanceof Types.ObjectId
          ? rawUserId.toHexString()
          : String(rawUserId);
      return enqueuePerUserAlertsDetectionJob(
        normalizedUserId,
        "post-metrics",
      ).catch((perUserEnqueueError: unknown) => {
        console.error(
          "[metricsAggregation.worker] per-user alerts enqueue failed",
          {
            userId: normalizedUserId,
            error:
              perUserEnqueueError instanceof Error
                ? perUserEnqueueError.message
                : String(perUserEnqueueError),
          },
        );
      });
    }),
  );
};

export const startMetricsAggregationWorker =
  (): Worker<MetricsAggregationJobPayload> => {
    const worker = createMetricsAggregationWorker(processMetricsAggregationJob);

    worker.on("failed", (failedJob, failureError) => {
      console.error("[metricsAggregation.worker] Job failed", {
        jobId: failedJob?.id,
        attemptsMade: failedJob?.attemptsMade,
        error: failureError,
      });
    });

    worker.on("error", (workerError) => {
      console.error("[metricsAggregation.worker] Worker error", workerError);
    });

    return worker;
  };
