import { Types } from "mongoose";

import { InsightJobModel } from "../api/models/insightJob.model.js";
import {
  type InsightType,
  InsightReadModel,
} from "../api/models/insightRead.model.js";
import {
  ANALYTICS_INSIGHTS_ROUTING_KEY,
  publishToAnalyticsExchange,
} from "../infrastructure/rabbitmq.js";

const MAX_RETRY_COUNT = 3;

type ServiceApiError = Error & { statusCode: number };

const createServiceApiError = (
  message: string,
  statusCode: number,
): ServiceApiError => {
  const apiError = new Error(message) as ServiceApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

type ListAdminInsightsFilters = {
  page: number;
  limit: number;
  type?: InsightType;
  userId?: string;
  startDate?: string;
  endDate?: string;
};

type DateRangeFilter = {
  $gte?: Date;
  $lte?: Date;
};

const buildCreatedAtDateRangeFilter = (
  startDate?: string,
  endDate?: string,
): DateRangeFilter | undefined => {
  if (!startDate && !endDate) {
    return undefined;
  }

  const createdAtFilter: DateRangeFilter = {};
  if (startDate) {
    createdAtFilter.$gte = new Date(`${startDate}T00:00:00.000Z`);
  }
  if (endDate) {
    createdAtFilter.$lte = new Date(`${endDate}T23:59:59.999Z`);
  }
  return createdAtFilter;
};

export const listAdminInsights = async (filters: ListAdminInsightsFilters) => {
  const skip = (filters.page - 1) * filters.limit;
  const createdAtFilter = buildCreatedAtDateRangeFilter(
    filters.startDate,
    filters.endDate,
  );

  const query: {
    type?: InsightType;
    userId?: string;
    createdAt?: DateRangeFilter;
  } = {};

  if (filters.type) {
    query.type = filters.type;
  }
  if (filters.userId) {
    query.userId = filters.userId;
  }
  if (createdAtFilter) {
    query.createdAt = createdAtFilter;
  }

  const [insights, total] = await Promise.all([
    InsightReadModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filters.limit)
      .select("userId type message confidence createdAt status")
      .lean(),
    InsightReadModel.countDocuments(query),
  ]);

  return {
    insights: insights.map((insight) => ({
      _id: insight._id.toString(),
      userId: insight.userId,
      type: insight.type,
      message: insight.message,
      confidence: insight.confidence,
      status: insight.status ?? "success",
      createdAt: insight.createdAt,
    })),
    pagination: {
      total,
      page: filters.page,
      limit: filters.limit,
    },
  };
};

export const listFailedInsightJobs = async (filters: {
  page: number;
  limit: number;
}) => {
  const skip = (filters.page - 1) * filters.limit;
  const query = { status: "failed" as const };

  const [jobs, total] = await Promise.all([
    InsightJobModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filters.limit)
      .select("userId jobId status error.message retryCount createdAt updatedAt")
      .lean(),
    InsightJobModel.countDocuments(query),
  ]);

  return {
    jobs: jobs.map((job) => ({
      _id: job._id.toString(),
      jobId: job.jobId,
      userId: job.userId,
      status: job.status,
      error: {
        message: job.error?.message ?? "Unknown error",
      },
      retryCount: job.retryCount,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    })),
    pagination: {
      total,
      page: filters.page,
      limit: filters.limit,
    },
  };
};

export const retryInsightJob = async (jobId: string) => {
  const existingJob = await InsightJobModel.findOne({ jobId }).lean();

  if (!existingJob) {
    throw createServiceApiError("Insight job not found", 404);
  }
  if (existingJob.status !== "failed") {
    throw createServiceApiError("Only failed insight jobs can be retried", 400);
  }
  if (existingJob.retryCount >= MAX_RETRY_COUNT) {
    throw createServiceApiError(
      "Retry limit reached for this insight job",
      400,
    );
  }
  if (!existingJob.payload || typeof existingJob.payload !== "object") {
    throw createServiceApiError("Retry payload missing for this insight job", 400);
  }

  const updatedRetryCount = existingJob.retryCount + 1;

  await publishToAnalyticsExchange(
    ANALYTICS_INSIGHTS_ROUTING_KEY,
    {
      ...(existingJob.payload as Record<string, unknown>),
      jobId: existingJob.jobId,
    },
    { messageId: existingJob.jobId },
  );

  await InsightJobModel.updateOne(
    { _id: existingJob._id },
    {
      $set: {
        status: "pending",
        lastRetriedAt: new Date(),
      },
      $inc: {
        retryCount: 1,
      },
    },
  );

  return {
    success: true,
    message: "Insight job queued for retry",
    retryCount: updatedRetryCount,
    maxRetry: MAX_RETRY_COUNT,
  };
};

export const getInsightDetails = async (insightId: string) => {
  if (!Types.ObjectId.isValid(insightId)) {
    throw createServiceApiError("Invalid insight id", 400);
  }

  const insight = await InsightReadModel.findById(insightId)
    .select("userId type message confidence metadata sourceDataSnapshot status createdAt")
    .lean();

  if (!insight) {
    throw createServiceApiError("Insight not found", 404);
  }

  return {
    _id: insight._id.toString(),
    userId: insight.userId,
    type: insight.type,
    message: insight.message,
    confidence: insight.confidence,
    metadata: insight.metadata ?? null,
    sourceDataSnapshot: insight.sourceDataSnapshot ?? null,
    status: insight.status ?? "success",
    createdAt: insight.createdAt,
  };
};

