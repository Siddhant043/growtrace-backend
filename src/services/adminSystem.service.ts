import { Types } from "mongoose";

import {
  ErrorLogModel,
  type ErrorLogSeverity,
  type ErrorLogSource,
} from "../api/models/errorLog.model.js";
import { QueueMetricModel } from "../api/models/queueMetric.model.js";
import { WorkerStatusModel } from "../api/models/workerStatus.model.js";
import { refreshWorkerHealthStatuses } from "./systemMonitoring.workerHealth.service.js";

type ServiceApiError = Error & { statusCode: number };

const createServiceApiError = (
  message: string,
  statusCode: number,
): ServiceApiError => {
  const apiError = new Error(message) as ServiceApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

type DateRangeFilter = {
  $gte?: Date;
  $lte?: Date;
};

const buildDateRangeFilter = (
  startDate?: string,
  endDate?: string,
): DateRangeFilter | undefined => {
  if (!startDate && !endDate) {
    return undefined;
  }
  if (!startDate || !endDate) {
    throw createServiceApiError(
      "Both startDate and endDate are required together",
      400,
    );
  }
  if (startDate > endDate) {
    throw createServiceApiError("startDate cannot be later than endDate", 400);
  }
  return {
    $gte: new Date(`${startDate}T00:00:00.000Z`),
    $lte: new Date(`${endDate}T23:59:59.999Z`),
  };
};

export const listAdminSystemQueueStatus = async () => {
  const rows = await QueueMetricModel.aggregate<{
    queueName: string;
    pendingJobs: number;
    processingJobs: number;
    failedJobs: number;
    throughputPerSecond: number;
    timestamp: Date;
  }>([
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: "$queueName",
        queueName: { $first: "$queueName" },
        pendingJobs: { $first: "$pendingJobs" },
        processingJobs: { $first: "$processingJobs" },
        failedJobs: { $first: "$failedJobs" },
        throughputPerSecond: { $first: "$throughputPerSecond" },
        timestamp: { $first: "$timestamp" },
      },
    },
    { $sort: { queueName: 1 } },
  ]);

  return rows;
};

export const listAdminSystemWorkerHealth = async () => {
  await refreshWorkerHealthStatuses();
  const rows = await WorkerStatusModel.find({})
    .sort({ workerName: 1 })
    .lean();

  return rows.map((row) => ({
    workerName: row.workerName,
    status: row.status,
    lastHeartbeatAt: row.lastHeartbeatAt,
    jobsProcessed: row.jobsProcessed,
    jobsFailed: row.jobsFailed,
    updatedAt: row.updatedAt,
  }));
};

export const listAdminSystemErrors = async (parameters: {
  page: number;
  limit: number;
  severity?: ErrorLogSeverity;
  source?: ErrorLogSource;
  startDate?: string;
  endDate?: string;
  sortBy?: "createdAt" | "severity" | "source";
  sortOrder?: "asc" | "desc";
}) => {
  const skip = (parameters.page - 1) * parameters.limit;
  const sortDirection = parameters.sortOrder === "asc" ? 1 : -1;
  const errorsSort: Record<string, 1 | -1> = {};
  if (parameters.sortBy === "severity") {
    errorsSort.severity = sortDirection;
    errorsSort.createdAt = -1;
  } else if (parameters.sortBy === "source") {
    errorsSort.source = sortDirection;
    errorsSort.createdAt = -1;
  } else {
    errorsSort.createdAt = sortDirection;
  }
  const dateRangeFilter = buildDateRangeFilter(
    parameters.startDate,
    parameters.endDate,
  );

  const query: {
    severity?: ErrorLogSeverity;
    source?: ErrorLogSource;
    createdAt?: DateRangeFilter;
  } = {};
  if (parameters.severity) {
    query.severity = parameters.severity;
  }
  if (parameters.source) {
    query.source = parameters.source;
  }
  if (dateRangeFilter) {
    query.createdAt = dateRangeFilter;
  }

  const [errors, total] = await Promise.all([
    ErrorLogModel.find(query)
      .sort(errorsSort)
      .skip(skip)
      .limit(parameters.limit)
      .lean(),
    ErrorLogModel.countDocuments(query),
  ]);

  return {
    errors: errors.map((errorDocument) => ({
      _id: errorDocument._id.toString(),
      source: errorDocument.source,
      service: errorDocument.service,
      message: errorDocument.message,
      severity: errorDocument.severity,
      metadata: errorDocument.metadata ?? {},
      createdAt: errorDocument.createdAt,
    })),
    pagination: {
      total,
      page: parameters.page,
      limit: parameters.limit,
    },
  };
};

export const getAdminSystemErrorDetails = async (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw createServiceApiError("Invalid error id", 400);
  }

  const errorDocument = await ErrorLogModel.findById(id).lean();
  if (!errorDocument) {
    throw createServiceApiError("Error log not found", 404);
  }

  return {
    _id: errorDocument._id.toString(),
    source: errorDocument.source,
    service: errorDocument.service,
    message: errorDocument.message,
    stack: errorDocument.stack ?? null,
    severity: errorDocument.severity,
    metadata: errorDocument.metadata ?? {},
    createdAt: errorDocument.createdAt,
    updatedAt: errorDocument.updatedAt,
  };
};
