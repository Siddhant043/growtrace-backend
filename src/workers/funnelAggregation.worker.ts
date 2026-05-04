import type { Job, Worker } from "bullmq";

import {
  createFunnelAggregationWorker,
  FUNNEL_AGGREGATION_SCHEDULER_IDS,
  type FunnelAggregationJobPayload,
} from "../infrastructure/queue.js";
import { aggregateAllFunnelScopesForDate } from "../services/funnelAggregation.service.js";
import {
  getCurrentUtcDateString,
  getPreviousUtcDateString,
} from "../utils/dateBounds.utils.js";

const resolveTargetDateForJob = (
  jobPayload: FunnelAggregationJobPayload,
): string => {
  if (
    jobPayload.schedulerId === FUNNEL_AGGREGATION_SCHEDULER_IDS.previousUtcDay
  ) {
    return getPreviousUtcDateString();
  }

  return getCurrentUtcDateString();
};

export const processFunnelAggregationJob = async (
  job: Job<FunnelAggregationJobPayload>,
): Promise<void> => {
  const targetDate = resolveTargetDateForJob(job.data);

  const aggregationStartedAt = Date.now();
  const aggregationSummary = await aggregateAllFunnelScopesForDate(targetDate);
  const aggregationDurationMs = Date.now() - aggregationStartedAt;

  console.info(
    `[funnelAggregation.worker] schedulerId=${job.data.schedulerId} ` +
      `date=${aggregationSummary.date} ` +
      `linkRows=${aggregationSummary.linkRowsUpserted} ` +
      `platformRows=${aggregationSummary.platformRowsUpserted} ` +
      `campaignRows=${aggregationSummary.campaignRowsUpserted} ` +
      `durationMs=${aggregationDurationMs}`,
  );
};

export const startFunnelAggregationWorker =
  (): Worker<FunnelAggregationJobPayload> => {
    const worker = createFunnelAggregationWorker(processFunnelAggregationJob);

    worker.on("failed", (failedJob, failureError) => {
      console.error("[funnelAggregation.worker] Job failed", {
        jobId: failedJob?.id,
        attemptsMade: failedJob?.attemptsMade,
        error: failureError,
      });
    });

    worker.on("error", (workerError) => {
      console.error("[funnelAggregation.worker] Worker error", workerError);
    });

    return worker;
  };
