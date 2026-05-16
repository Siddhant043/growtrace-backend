import type { Job, Worker } from "bullmq";

import {
  createInsightsPublishWorker,
  INSIGHTS_PUBLISH_QUEUE_NAME,
  type InsightsPublishJobPayload,
} from "../infrastructure/queue.js";
import { publishSnapshotsForActiveUsers } from "../services/insightsPublisher.service.js";
import { attachWorkerMonitoring } from "../services/systemMonitoring.workerHealth.service.js";
import { getCurrentUtcDateString } from "../utils/dateBounds.utils.js";

export const processInsightsPublishJob = async (
  job: Job<InsightsPublishJobPayload>,
): Promise<void> => {
  const asOfDateIso = getCurrentUtcDateString();
  const publishStartedAt = Date.now();
  const publishSummary = await publishSnapshotsForActiveUsers(asOfDateIso);
  const publishDurationMs = Date.now() - publishStartedAt;

  console.info(
    `[insightsPublish.worker] schedulerId=${job.data.schedulerId} ` +
      `date=${asOfDateIso} ` +
      `attempted=${publishSummary.attemptedUserCount} ` +
      `published=${publishSummary.publishedUserCount} ` +
      `failed=${publishSummary.failedUserCount} ` +
      `durationMs=${publishDurationMs}`,
  );
};

export const startInsightsPublishWorker =
  (): Worker<InsightsPublishJobPayload> => {
    const worker = createInsightsPublishWorker(processInsightsPublishJob);
    attachWorkerMonitoring(worker, INSIGHTS_PUBLISH_QUEUE_NAME);

    worker.on("failed", (failedJob, failureError) => {
      console.error("[insightsPublish.worker] Job failed", {
        jobId: failedJob?.id,
        attemptsMade: failedJob?.attemptsMade,
        error: failureError,
      });
    });

    worker.on("error", (workerError) => {
      console.error("[insightsPublish.worker] Worker error", workerError);
    });

    return worker;
  };
