import type { Job, Worker } from "bullmq";

import { env } from "../config/env.js";
import {
  ATTRIBUTION_QUEUE_NAME,
  createAttributionWorker,
  type AttributionTouchpointJobPayload,
} from "../infrastructure/queue.js";
import { processAttributionTouchpointJob } from "../services/attributionJourney.service.js";
import { attachWorkerMonitoring } from "../services/systemMonitoring.workerHealth.service.js";

let cachedAttributionWorker: Worker<AttributionTouchpointJobPayload> | null =
  null;

const handleAttributionJob = async (
  job: Job<AttributionTouchpointJobPayload>,
): Promise<void> => {
  const result = await processAttributionTouchpointJob(job.data);

  if (result.status !== "ingested" && result.status !== "deduplicated") {
    console.info("[attribution.worker] skipped", {
      jobId: job.id,
      status: result.status,
      type: job.data.type,
    });
  }
};

export const startAttributionWorker =
  (): Worker<AttributionTouchpointJobPayload> => {
    if (cachedAttributionWorker) {
      return cachedAttributionWorker;
    }

    cachedAttributionWorker = createAttributionWorker(handleAttributionJob, {
      concurrency: env.ATTRIBUTION_WORKER_CONCURRENCY,
    });
    attachWorkerMonitoring(cachedAttributionWorker, ATTRIBUTION_QUEUE_NAME);

    cachedAttributionWorker.on("failed", (job, error) => {
      console.error("[attribution.worker] job failed", {
        jobId: job?.id,
        attempts: job?.attemptsMade,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    cachedAttributionWorker.on("error", (error) => {
      console.error("[attribution.worker] worker error", {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return cachedAttributionWorker;
  };

export const getAttributionWorker =
  (): Worker<AttributionTouchpointJobPayload> | null => cachedAttributionWorker;
