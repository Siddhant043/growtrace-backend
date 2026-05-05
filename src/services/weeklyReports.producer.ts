import { Types } from "mongoose";

import { LinkMetricsDailyModel } from "../api/models/linkMetricsDaily.model.js";
import { ReportJobModel } from "../api/models/reportJob.model.js";
import {
  WEEKLY_REPORTS_USER_JOB_NAME,
  getWeeklyReportsQueue,
  type WeeklyReportsUserJobPayload,
} from "../infrastructure/queue.js";
import {
  computePreviousIsoWeekWindow,
  computeWeekWindowEndingOnDate,
  type WeeklyReportDateWindow,
} from "../utils/weeklyReports.dateWindow.js";

const ENQUEUE_BATCH_SIZE = 200;

type ProduceWeeklyReportsParameters = {
  reason: "cron" | "manual";
  targetWeekEndDateIso?: string;
};

export type ProduceWeeklyReportsSummary = {
  reason: "cron" | "manual";
  weekStartIsoDate: string;
  weekEndIsoDate: string;
  candidateUserCount: number;
  enqueuedJobCount: number;
};

const findUserIdsActiveDuringWindow = async (
  window: WeeklyReportDateWindow,
): Promise<string[]> => {
  const distinctActiveUserIds = await LinkMetricsDailyModel.distinct("userId", {
    date: { $gte: window.weekStartIsoDate, $lte: window.weekEndIsoDate },
  });

  if (distinctActiveUserIds.length === 0) {
    return [];
  }

  return distinctActiveUserIds.map((rawUserIdValue) => {
    if (rawUserIdValue instanceof Types.ObjectId) {
      return rawUserIdValue.toHexString();
    }
    return String(rawUserIdValue);
  });
};

const buildWeeklyReportJobId = (
  userId: string,
  weekStartIsoDate: string,
): string => `wr:${userId}:${weekStartIsoDate}`;

const enqueueWeeklyReportJobsForUserIdBatch = async (
  batchUserIds: readonly string[],
  window: WeeklyReportDateWindow,
  reason: "cron" | "manual",
): Promise<number> => {
  const weeklyReportsQueue = getWeeklyReportsQueue();
  const weekStartDate = new Date(`${window.weekStartIsoDate}T00:00:00.000Z`);
  const weekEndDate = new Date(`${window.weekEndIsoDate}T00:00:00.000Z`);

  await Promise.all(
    batchUserIds.map(async (userId) => {
      await ReportJobModel.updateOne(
        {
          userId: new Types.ObjectId(userId),
          weekStart: weekStartDate,
        },
        {
          $set: {
            weekEnd: weekEndDate,
            status: "pending",
            error: { message: null },
          },
          $setOnInsert: {
            retryCount: 0,
          },
        },
        { upsert: true },
      ).exec();
    }),
  );

  const jobsToAdd = batchUserIds.map((userId) => {
    const jobPayload: WeeklyReportsUserJobPayload = {
      userId,
      weekStartIso: window.weekStartIsoDate,
      weekEndIso: window.weekEndIsoDate,
      reason,
    };

    return {
      name: WEEKLY_REPORTS_USER_JOB_NAME,
      data: jobPayload,
      opts: {
        jobId: buildWeeklyReportJobId(userId, window.weekStartIsoDate),
      },
    };
  });

  const addedJobs = await weeklyReportsQueue.addBulk(jobsToAdd);
  return addedJobs.length;
};

export const enqueueWeeklyReportForUser = async (parameters: {
  userId: string;
  reason: "cron" | "manual";
  targetWeekEndDateIso?: string;
}): Promise<{
  weekStartIsoDate: string;
  weekEndIsoDate: string;
  enqueued: boolean;
}> => {
  const window = parameters.targetWeekEndDateIso
    ? computeWeekWindowEndingOnDate(parameters.targetWeekEndDateIso)
    : computePreviousIsoWeekWindow();

  const weeklyReportsQueue = getWeeklyReportsQueue();
  const jobId = buildWeeklyReportJobId(parameters.userId, window.weekStartIsoDate);

  await ReportJobModel.updateOne(
    {
      userId: new Types.ObjectId(parameters.userId),
      weekStart: new Date(`${window.weekStartIsoDate}T00:00:00.000Z`),
    },
    {
      $set: {
        weekEnd: new Date(`${window.weekEndIsoDate}T00:00:00.000Z`),
        status: "pending",
        error: { message: null },
      },
      $setOnInsert: {
        retryCount: 0,
      },
    },
    { upsert: true },
  ).exec();

  await weeklyReportsQueue.add(
    WEEKLY_REPORTS_USER_JOB_NAME,
    {
      userId: parameters.userId,
      weekStartIso: window.weekStartIsoDate,
      weekEndIso: window.weekEndIsoDate,
      reason: parameters.reason,
    },
    { jobId },
  );

  return {
    weekStartIsoDate: window.weekStartIsoDate,
    weekEndIsoDate: window.weekEndIsoDate,
    enqueued: true,
  };
};

export const produceWeeklyReports = async (
  parameters: ProduceWeeklyReportsParameters,
): Promise<ProduceWeeklyReportsSummary> => {
  const window = parameters.targetWeekEndDateIso
    ? computeWeekWindowEndingOnDate(parameters.targetWeekEndDateIso)
    : computePreviousIsoWeekWindow();

  const candidateUserIds = await findUserIdsActiveDuringWindow(window);

  let enqueuedJobCount = 0;
  for (
    let batchStartIndex = 0;
    batchStartIndex < candidateUserIds.length;
    batchStartIndex += ENQUEUE_BATCH_SIZE
  ) {
    const batchUserIds = candidateUserIds.slice(
      batchStartIndex,
      batchStartIndex + ENQUEUE_BATCH_SIZE,
    );
    const addedCount = await enqueueWeeklyReportJobsForUserIdBatch(
      batchUserIds,
      window,
      parameters.reason,
    );
    enqueuedJobCount += addedCount;
  }

  return {
    reason: parameters.reason,
    weekStartIsoDate: window.weekStartIsoDate,
    weekEndIsoDate: window.weekEndIsoDate,
    candidateUserCount: candidateUserIds.length,
    enqueuedJobCount,
  };
};
