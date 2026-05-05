import type { Job, Worker } from "bullmq";

import {
  ADMIN_ANALYTICS_AGGREGATION_SCHEDULER_IDS,
  ADMIN_FUNNEL_METRICS_AGGREGATION_QUEUE_NAME,
  ADMIN_PLATFORM_METRICS_AGGREGATION_QUEUE_NAME,
  ADMIN_USAGE_METRICS_AGGREGATION_QUEUE_NAME,
  createAdminFunnelMetricsAggregationWorker,
  createAdminPlatformMetricsAggregationWorker,
  createAdminUsageMetricsAggregationWorker,
  type AdminAnalyticsAggregationJobPayload,
} from "../infrastructure/queue.js";
import {
  aggregateAdminFunnelMetricsForDate,
  aggregateAdminPlatformMetricsForDate,
  aggregateAdminUsageMetricsForDate,
  getCurrentUtcDateString,
  getPreviousUtcDateString,
} from "../services/adminAnalyticsAggregation.service.js";
import { attachWorkerMonitoring } from "../services/systemMonitoring.workerHealth.service.js";

const resolveTargetDateForJob = (
  jobPayload: AdminAnalyticsAggregationJobPayload,
): string => {
  if (
    jobPayload.schedulerId ===
    ADMIN_ANALYTICS_AGGREGATION_SCHEDULER_IDS.previousUtcDay
  ) {
    return getPreviousUtcDateString();
  }

  return getCurrentUtcDateString();
};

const processPlatformAggregationJob = async (
  job: Job<AdminAnalyticsAggregationJobPayload>,
): Promise<void> => {
  const targetDate = resolveTargetDateForJob(job.data);
  const rowsUpserted = await aggregateAdminPlatformMetricsForDate(targetDate);
  console.info(
    `[adminPlatformMetricsAggregation.worker] schedulerId=${job.data.schedulerId} date=${targetDate} rowsUpserted=${rowsUpserted}`,
  );
};

const processUsageAggregationJob = async (
  job: Job<AdminAnalyticsAggregationJobPayload>,
): Promise<void> => {
  const targetDate = resolveTargetDateForJob(job.data);
  const rowsUpserted = await aggregateAdminUsageMetricsForDate(targetDate);
  console.info(
    `[adminUsageMetricsAggregation.worker] schedulerId=${job.data.schedulerId} date=${targetDate} rowsUpserted=${rowsUpserted}`,
  );
};

const processFunnelAggregationJob = async (
  job: Job<AdminAnalyticsAggregationJobPayload>,
): Promise<void> => {
  const targetDate = resolveTargetDateForJob(job.data);
  const rowsUpserted = await aggregateAdminFunnelMetricsForDate(targetDate);
  console.info(
    `[adminFunnelMetricsAggregation.worker] schedulerId=${job.data.schedulerId} date=${targetDate} rowsUpserted=${rowsUpserted}`,
  );
};

type AdminAnalyticsWorkers = {
  platformWorker: Worker<AdminAnalyticsAggregationJobPayload>;
  usageWorker: Worker<AdminAnalyticsAggregationJobPayload>;
  funnelWorker: Worker<AdminAnalyticsAggregationJobPayload>;
};

const attachWorkerErrorHandlers = (
  worker: Worker<AdminAnalyticsAggregationJobPayload>,
  workerName: string,
): void => {
  worker.on("failed", (failedJob, failureError) => {
    console.error(`[${workerName}] Job failed`, {
      jobId: failedJob?.id,
      attemptsMade: failedJob?.attemptsMade,
      error: failureError,
    });
  });

  worker.on("error", (workerError) => {
    console.error(`[${workerName}] Worker error`, workerError);
  });
};

export const startAdminAnalyticsAggregationWorkers =
  (): AdminAnalyticsWorkers => {
    const platformWorker = createAdminPlatformMetricsAggregationWorker(
      processPlatformAggregationJob,
    );
    const usageWorker = createAdminUsageMetricsAggregationWorker(
      processUsageAggregationJob,
    );
    const funnelWorker = createAdminFunnelMetricsAggregationWorker(
      processFunnelAggregationJob,
    );

    attachWorkerErrorHandlers(
      platformWorker,
      "adminPlatformMetricsAggregation.worker",
    );
    attachWorkerErrorHandlers(usageWorker, "adminUsageMetricsAggregation.worker");
    attachWorkerErrorHandlers(
      funnelWorker,
      "adminFunnelMetricsAggregation.worker",
    );
    attachWorkerMonitoring(
      platformWorker,
      ADMIN_PLATFORM_METRICS_AGGREGATION_QUEUE_NAME,
    );
    attachWorkerMonitoring(usageWorker, ADMIN_USAGE_METRICS_AGGREGATION_QUEUE_NAME);
    attachWorkerMonitoring(
      funnelWorker,
      ADMIN_FUNNEL_METRICS_AGGREGATION_QUEUE_NAME,
    );

    return {
      platformWorker,
      usageWorker,
      funnelWorker,
    };
  };

