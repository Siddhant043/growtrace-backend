import type { Job, Worker } from "bullmq";

import {
  createMetricsAggregationWorker,
  METRICS_AGGREGATION_SCHEDULER_IDS,
  type MetricsAggregationJobPayload,
} from "../infrastructure/queue";
import {
  aggregateAllScopesForDate,
  getCurrentUtcDateString,
  getPreviousUtcDateString,
} from "../services/metricsAggregation.service";

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
