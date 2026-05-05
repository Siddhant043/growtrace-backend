import type { Job, Worker } from "bullmq";
import { Types } from "mongoose";

import { env } from "../config/env.js";
import { ReportJobModel } from "../api/models/reportJob.model.js";
import { sendWeeklyReportEmail } from "../infrastructure/email.js";
import {
  WEEKLY_REPORTS_PRODUCER_JOB_NAME,
  WEEKLY_REPORTS_QUEUE_NAME,
  WEEKLY_REPORTS_USER_JOB_NAME,
  createWeeklyReportsWorker,
  type WeeklyReportsJobPayload,
  type WeeklyReportsProducerJobPayload,
  type WeeklyReportsUserJobPayload,
} from "../infrastructure/queue.js";
import {
  WeeklyReportModel,
  type WeeklyReportDeliveryStatus,
} from "../api/models/weeklyReport.model.js";
import {
  generateAndPersistWeeklyReport,
  type GenerateAndPersistResult,
} from "../services/weeklyReportGenerator.service.js";
import { computeWeekWindowEndingOnDate } from "../utils/weeklyReports.dateWindow.js";
import { produceWeeklyReports } from "../services/weeklyReports.producer.js";
import { attachWorkerMonitoring } from "../services/systemMonitoring.workerHealth.service.js";

const isProducerJobPayload = (
  jobPayload: WeeklyReportsJobPayload,
): jobPayload is WeeklyReportsProducerJobPayload => {
  return (
    "reason" in jobPayload &&
    !("userId" in jobPayload) &&
    !("weekStartIso" in jobPayload)
  );
};

const isUserJobPayload = (
  jobPayload: WeeklyReportsJobPayload,
): jobPayload is WeeklyReportsUserJobPayload => {
  return (
    "userId" in jobPayload &&
    "weekStartIso" in jobPayload &&
    "weekEndIso" in jobPayload
  );
};

const updateDeliveryStatusForReport = async (
  reportId: WeeklyReportsUserJobPayload,
  newStatus: WeeklyReportDeliveryStatus,
  partialFields: { emailMessageId?: string; failureReason?: string } = {},
): Promise<void> => {
  await WeeklyReportModel.updateOne(
    {
      userId: reportId.userId,
      weekStart: new Date(`${reportId.weekStartIso}T00:00:00.000Z`),
    },
    {
      $set: {
        deliveryStatus: newStatus,
        ...(partialFields.emailMessageId !== undefined && {
          emailMessageId: partialFields.emailMessageId,
        }),
        ...(partialFields.failureReason !== undefined && {
          failureReason: partialFields.failureReason,
        }),
      },
    },
  ).exec();
};

const updateReportJobForUserPayload = async (
  payload: WeeklyReportsUserJobPayload,
  update: {
    status: "processing" | "generated" | "failed";
    errorMessage?: string | null;
    incrementRetryCount?: boolean;
  },
): Promise<void> => {
  await ReportJobModel.updateOne(
    {
      userId: new Types.ObjectId(payload.userId),
      weekStart: new Date(`${payload.weekStartIso}T00:00:00.000Z`),
    },
    {
      $set: {
        weekEnd: new Date(`${payload.weekEndIso}T00:00:00.000Z`),
        status: update.status,
        error: {
          message: update.errorMessage ?? null,
        },
      },
      ...(update.incrementRetryCount ? { $inc: { retryCount: 1 } } : {}),
    },
    { upsert: true },
  ).exec();
};

const processProducerJob = async (
  job: Job<WeeklyReportsProducerJobPayload>,
): Promise<void> => {
  const summary = await produceWeeklyReports({
    reason: job.data.reason,
    targetWeekEndDateIso: job.data.targetWeekEndDateIso,
  });

  console.info(
    `[weeklyReports.worker] producer reason=${summary.reason} ` +
      `weekStart=${summary.weekStartIsoDate} weekEnd=${summary.weekEndIsoDate} ` +
      `candidates=${summary.candidateUserCount} enqueued=${summary.enqueuedJobCount}`,
  );
};

const processUserJob = async (
  job: Job<WeeklyReportsUserJobPayload>,
): Promise<void> => {
  await updateReportJobForUserPayload(job.data, {
    status: "processing",
    errorMessage: null,
  });

  const window = computeWeekWindowEndingOnDate(job.data.weekEndIso);
  try {
    const generationResult: GenerateAndPersistResult =
      await generateAndPersistWeeklyReport({
        userId: job.data.userId,
        window,
      });

    if (!generationResult.shouldEmail) {
      await updateReportJobForUserPayload(job.data, {
        status: "generated",
        errorMessage: null,
      });
      console.info(
        `[weeklyReports.worker] user job skipped userId=${job.data.userId} ` +
          `weekStart=${job.data.weekStartIso} reason=${generationResult.skipReason ?? "unknown"}`,
      );
      return;
    }

    const baseUrl = env.CLIENT_APP_URL;
    const sendResult = await sendWeeklyReportEmail({
      recipientEmail: generationResult.payload.recipientEmail,
      recipientFullName: generationResult.payload.recipientFullName,
      viewModel: {
        payload: generationResult.payload,
        webBaseUrl: baseUrl,
      },
    });

    await updateDeliveryStatusForReport(job.data, "emailed", {
      emailMessageId: sendResult.messageId,
    });
    await updateReportJobForUserPayload(job.data, {
      status: "generated",
      errorMessage: null,
    });

    console.info(
      `[weeklyReports.worker] user job emailed userId=${job.data.userId} ` +
        `weekStart=${job.data.weekStartIso} messageId=${sendResult.messageId}`,
    );
  } catch (emailError) {
    const failureMessage =
      emailError instanceof Error ? emailError.message : String(emailError);

    await updateDeliveryStatusForReport(job.data, "failed", {
      failureReason: failureMessage.slice(0, 500),
    });
    await updateReportJobForUserPayload(job.data, {
      status: "failed",
      errorMessage: failureMessage.slice(0, 500),
      incrementRetryCount: true,
    });

    throw emailError;
  }
};

export const processWeeklyReportsJob = async (
  job: Job<WeeklyReportsJobPayload>,
): Promise<void> => {
  if (job.name === WEEKLY_REPORTS_PRODUCER_JOB_NAME) {
    if (!isProducerJobPayload(job.data)) {
      throw new Error(
        "weeklyReports.worker: producer job missing expected payload shape",
      );
    }
    await processProducerJob(job as Job<WeeklyReportsProducerJobPayload>);
    return;
  }

  if (job.name === WEEKLY_REPORTS_USER_JOB_NAME) {
    if (!isUserJobPayload(job.data)) {
      throw new Error(
        "weeklyReports.worker: user job missing expected payload shape",
      );
    }
    await processUserJob(job as Job<WeeklyReportsUserJobPayload>);
    return;
  }

  console.warn(
    `[weeklyReports.worker] unknown job name=${job.name} id=${String(job.id)}`,
  );
};

export const startWeeklyReportsWorker = (): Worker<WeeklyReportsJobPayload> => {
  const worker = createWeeklyReportsWorker(processWeeklyReportsJob, {
    concurrency: env.WEEKLY_REPORTS_WORKER_CONCURRENCY,
  });
  attachWorkerMonitoring(worker, WEEKLY_REPORTS_QUEUE_NAME);

  worker.on("failed", (failedJob, failureError) => {
    console.error("[weeklyReports.worker] Job failed", {
      jobId: failedJob?.id,
      jobName: failedJob?.name,
      attemptsMade: failedJob?.attemptsMade,
      error:
        failureError instanceof Error
          ? failureError.message
          : String(failureError),
    });
  });

  worker.on("error", (workerError) => {
    console.error("[weeklyReports.worker] Worker error", workerError);
  });

  return worker;
};
