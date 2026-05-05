import type { Job, Worker } from "bullmq";
import { Types } from "mongoose";

import { env } from "../config/env.js";
import { LinkMetricsDailyModel } from "../api/models/linkMetricsDaily.model.js";
import {
  ALERTS_DETECTION_QUEUE_NAME,
  buildAlertsDetectionJobId,
  createAlertsDetectionWorker,
  getAlertsDetectionQueue,
  type AlertsDetectionJobPayload,
  type AlertsDetectionReason,
} from "../infrastructure/queue.js";
import {
  produceAlertsForUser,
  type ProduceAlertsForUserSummary,
} from "../services/alertProducer.service.js";
import { attachWorkerMonitoring } from "../services/systemMonitoring.workerHealth.service.js";

interface DetectionFanOutSummary {
  attemptedUserCount: number;
  enqueuedFanOutJobs: number;
}

const ENQUEUE_BATCH_SIZE = 200;

const buildLookbackStartIso = (lookbackDays: number): string => {
  const lookbackStart = new Date();
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - lookbackDays);
  return lookbackStart.toISOString().slice(0, 10);
};

const listActiveUserIdsForDetection = async (): Promise<string[]> => {
  const lookbackStartIso = buildLookbackStartIso(
    env.ALERTS_DETECTION_ACTIVE_WINDOW_DAYS,
  );

  const distinctActiveUserIds = await LinkMetricsDailyModel.distinct("userId", {
    date: { $gte: lookbackStartIso },
  });

  return distinctActiveUserIds.map((rawUserIdValue) => {
    if (rawUserIdValue instanceof Types.ObjectId) {
      return rawUserIdValue.toHexString();
    }
    return String(rawUserIdValue);
  });
};

const fanOutPerUserDetectionJobs = async (
  reason: AlertsDetectionReason,
): Promise<DetectionFanOutSummary> => {
  const activeUserIds = await listActiveUserIdsForDetection();
  if (activeUserIds.length === 0) {
    return { attemptedUserCount: 0, enqueuedFanOutJobs: 0 };
  }

  const alertsDetectionQueue = getAlertsDetectionQueue();
  let enqueuedFanOutJobs = 0;

  for (
    let batchStartIndex = 0;
    batchStartIndex < activeUserIds.length;
    batchStartIndex += ENQUEUE_BATCH_SIZE
  ) {
    const batchUserIds = activeUserIds.slice(
      batchStartIndex,
      batchStartIndex + ENQUEUE_BATCH_SIZE,
    );

    const jobsToAdd = batchUserIds.map((activeUserId) => ({
      name: "detect-user",
      data: {
        userId: activeUserId,
        reason,
        schedulerId: null,
      } satisfies AlertsDetectionJobPayload,
      opts: {
        jobId: buildAlertsDetectionJobId(activeUserId, reason),
      },
    }));

    const enqueuedJobs = await alertsDetectionQueue.addBulk(jobsToAdd);
    enqueuedFanOutJobs += enqueuedJobs.length;
  }

  return {
    attemptedUserCount: activeUserIds.length,
    enqueuedFanOutJobs,
  };
};

export type AlertsDetectionJobOutcome =
  | { kind: "fanout"; summary: DetectionFanOutSummary }
  | { kind: "single"; summary: ProduceAlertsForUserSummary };

export const processAlertsDetectionJob = async (
  job: Job<AlertsDetectionJobPayload>,
): Promise<AlertsDetectionJobOutcome> => {
  const { userId, reason } = job.data;

  if (!userId) {
    const fanOutSummary = await fanOutPerUserDetectionJobs(reason);
    console.info(
      `[alertsDetection.worker] fanout reason=${reason} ` +
        `attemptedUsers=${fanOutSummary.attemptedUserCount} ` +
        `enqueuedFanOutJobs=${fanOutSummary.enqueuedFanOutJobs}`,
    );
    return { kind: "fanout", summary: fanOutSummary };
  }

  const detectionStartedAt = Date.now();
  const productionSummary = await produceAlertsForUser(userId, reason);
  const detectionDurationMs = Date.now() - detectionStartedAt;

  console.info(
    `[alertsDetection.worker] perUser reason=${reason} userId=${userId} ` +
      `candidates=${productionSummary.evaluatedCandidateCount} ` +
      `dispatched=${productionSummary.enqueuedDispatchJobCount} ` +
      `skipReason=${productionSummary.skipReason ?? "none"} ` +
      `durationMs=${detectionDurationMs}`,
  );

  return { kind: "single", summary: productionSummary };
};

export const startAlertsDetectionWorker =
  (): Worker<AlertsDetectionJobPayload> => {
    const worker = createAlertsDetectionWorker(processAlertsDetectionJob);
    attachWorkerMonitoring(worker, ALERTS_DETECTION_QUEUE_NAME);

    worker.on("failed", (failedJob, failureError) => {
      console.error("[alertsDetection.worker] Job failed", {
        jobId: failedJob?.id,
        attemptsMade: failedJob?.attemptsMade,
        error: failureError,
      });
    });

    worker.on("error", (workerError) => {
      console.error("[alertsDetection.worker] Worker error", workerError);
    });

    return worker;
  };
