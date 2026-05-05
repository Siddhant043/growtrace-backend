import type { Worker } from "bullmq";

import {
  WorkerStatusModel,
  type WorkerStatus,
} from "../api/models/workerStatus.model.js";
import { captureSystemError } from "./systemMonitoring.errorLog.service.js";

const HEALTHY_HEARTBEAT_THRESHOLD_MS = 30_000;
const DEGRADED_HEARTBEAT_THRESHOLD_MS = 60_000;

const resolveWorkerStatusFromHeartbeat = (lastHeartbeatAt: Date): WorkerStatus => {
  const staleDurationMs = Date.now() - lastHeartbeatAt.getTime();
  if (staleDurationMs > DEGRADED_HEARTBEAT_THRESHOLD_MS) {
    return "down";
  }
  if (staleDurationMs > HEALTHY_HEARTBEAT_THRESHOLD_MS) {
    return "degraded";
  }
  return "healthy";
};

const updateWorkerHeartbeat = async (workerName: string): Promise<void> => {
  await WorkerStatusModel.updateOne(
    { workerName },
    {
      $set: {
        workerName,
        lastHeartbeatAt: new Date(),
        status: "healthy",
      },
      $setOnInsert: {
        jobsProcessed: 0,
        jobsFailed: 0,
      },
    },
    { upsert: true },
  ).exec();
};

export const attachWorkerMonitoring = <TData>(
  worker: Worker<TData>,
  workerName: string,
): void => {
  void updateWorkerHeartbeat(workerName);

  worker.on("active", () => {
    void updateWorkerHeartbeat(workerName);
  });

  worker.on("completed", () => {
    void WorkerStatusModel.updateOne(
      { workerName },
      {
        $set: {
          workerName,
          lastHeartbeatAt: new Date(),
          status: "healthy",
        },
        $inc: {
          jobsProcessed: 1,
        },
      },
      { upsert: true },
    ).exec();
  });

  worker.on("failed", (failedJob, failureError) => {
    const errorMessage =
      failureError instanceof Error ? failureError.message : String(failureError);

    void WorkerStatusModel.updateOne(
      { workerName },
      {
        $set: {
          workerName,
          lastHeartbeatAt: new Date(),
          status: "degraded",
        },
        $inc: {
          jobsFailed: 1,
        },
      },
      { upsert: true },
    ).exec();

    void captureSystemError({
      source: "worker",
      service: workerName,
      severity: "medium",
      message: errorMessage,
      stack: failureError instanceof Error ? (failureError.stack ?? null) : null,
      metadata: {
        event: "job_failed",
        jobId: failedJob?.id ? String(failedJob.id) : null,
        attemptsMade: failedJob?.attemptsMade ?? null,
      },
    });
  });

  worker.on("error", (workerError) => {
    const errorMessage =
      workerError instanceof Error ? workerError.message : String(workerError);

    void captureSystemError({
      source: "worker",
      service: workerName,
      severity: "high",
      message: errorMessage,
      stack: workerError instanceof Error ? (workerError.stack ?? null) : null,
      metadata: { event: "worker_error" },
    });
  });
};

export const refreshWorkerHealthStatuses = async (): Promise<void> => {
  const workers = await WorkerStatusModel.find({}).lean();
  await Promise.all(
    workers.map((worker) =>
      WorkerStatusModel.updateOne(
        { _id: worker._id },
        {
          $set: {
            status: resolveWorkerStatusFromHeartbeat(worker.lastHeartbeatAt),
          },
        },
      ).exec(),
    ),
  );
};
