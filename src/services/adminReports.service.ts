import { Types } from "mongoose";

import { ReportJobModel, type ReportJobStatus } from "../api/models/reportJob.model.js";
import {
  WeeklyReportModel,
  type WeeklyReportDeliveryStatus,
} from "../api/models/weeklyReport.model.js";
import { UserModel } from "../api/models/user.model.js";
import { enqueueWeeklyReportForUser } from "./weeklyReports.producer.js";

type ServiceApiError = Error & { statusCode: number };

const createServiceApiError = (
  message: string,
  statusCode: number,
): ServiceApiError => {
  const apiError = new Error(message) as ServiceApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

const toObjectId = (value: string): Types.ObjectId => new Types.ObjectId(value);

type Pagination = {
  total: number;
  page: number;
  limit: number;
};

const formatReport = (report: {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  weekStart: Date;
  weekEnd: Date;
  deliveryStatus: WeeklyReportDeliveryStatus;
  summary?: { headline?: string; deltaPct?: number; isMinimal?: boolean };
  createdAt: Date;
  updatedAt: Date;
}) => ({
  _id: report._id.toString(),
  userId: report.userId.toString(),
  weekStart: report.weekStart,
  weekEnd: report.weekEnd,
  deliveryStatus: report.deliveryStatus,
  summary: {
    headline: report.summary?.headline ?? "",
    deltaPct: report.summary?.deltaPct ?? 0,
    isMinimal: report.summary?.isMinimal ?? false,
  },
  createdAt: report.createdAt,
  updatedAt: report.updatedAt,
});

export const listAdminReports = async (filters: {
  page: number;
  limit: number;
  userId?: string;
  status?: WeeklyReportDeliveryStatus;
}): Promise<{
  reports: Array<ReturnType<typeof formatReport>>;
  pagination: Pagination;
}> => {
  const skip = (filters.page - 1) * filters.limit;
  const query: {
    userId?: Types.ObjectId;
    deliveryStatus?: WeeklyReportDeliveryStatus;
  } = {};

  if (filters.userId) {
    query.userId = toObjectId(filters.userId);
  }
  if (filters.status) {
    query.deliveryStatus = filters.status;
  }

  const [reports, total] = await Promise.all([
    WeeklyReportModel.find(query)
      .sort({ weekStart: -1, createdAt: -1 })
      .skip(skip)
      .limit(filters.limit)
      .select("userId weekStart weekEnd summary deliveryStatus createdAt updatedAt")
      .lean(),
    WeeklyReportModel.countDocuments(query),
  ]);

  return {
    reports: reports.map((report) =>
      formatReport({
        _id: report._id,
        userId: report.userId,
        weekStart: report.weekStart,
        weekEnd: report.weekEnd,
        deliveryStatus: report.deliveryStatus,
        summary: report.summary,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      }),
    ),
    pagination: {
      total,
      page: filters.page,
      limit: filters.limit,
    },
  };
};

export const getAdminReportDetails = async (reportId: string) => {
  const report = await WeeklyReportModel.findById(toObjectId(reportId)).lean();
  if (!report) {
    return null;
  }

  return {
    _id: report._id.toString(),
    userId: report.userId.toString(),
    weekStart: report.weekStart,
    weekEnd: report.weekEnd,
    topPlatform: report.topPlatform,
    topContent: {
      ...report.topContent,
      linkId:
        report.topContent?.linkId instanceof Types.ObjectId
          ? report.topContent.linkId.toString()
          : null,
    },
    trends: report.trends,
    insights: report.insights.map((entry) => ({
      ...entry,
      insightId:
        entry.insightId instanceof Types.ObjectId ? entry.insightId.toString() : null,
    })),
    recommendations: report.recommendations.map((entry) => ({
      ...entry,
      insightId:
        entry.insightId instanceof Types.ObjectId ? entry.insightId.toString() : null,
    })),
    summary: report.summary,
    deliveryStatus: report.deliveryStatus,
    emailMessageId: report.emailMessageId ?? null,
    failureReason: report.failureReason ?? null,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
};

export const listAdminReportHistory = async (parameters: {
  userId: string;
  page: number;
  limit: number;
}) => {
  const targetUser = await UserModel.findOne({
    _id: toObjectId(parameters.userId),
    isDeleted: false,
  })
    .select("email fullName")
    .lean();
  if (!targetUser) {
    throw createServiceApiError("User not found", 404);
  }

  const listResult = await listAdminReports({
    page: parameters.page,
    limit: parameters.limit,
    userId: parameters.userId,
  });

  return {
    user: {
      _id: targetUser._id.toString(),
      email: targetUser.email,
      fullName: targetUser.fullName ?? "",
    },
    reports: listResult.reports,
    pagination: listResult.pagination,
  };
};

export const triggerAdminReportGeneration = async (parameters: { userId: string }) => {
  const user = await UserModel.findOne({
    _id: toObjectId(parameters.userId),
    isDeleted: false,
  })
    .select("email")
    .lean();
  if (!user) {
    throw createServiceApiError("User not found", 404);
  }

  const enqueueResult = await enqueueWeeklyReportForUser({
    userId: parameters.userId,
    reason: "manual",
  });

  return {
    success: true,
    userId: parameters.userId,
    weekStartIsoDate: enqueueResult.weekStartIsoDate,
    weekEndIsoDate: enqueueResult.weekEndIsoDate,
    enqueued: enqueueResult.enqueued,
  };
};

export const listAdminReportJobs = async (filters: {
  page: number;
  limit: number;
  userId?: string;
  status?: ReportJobStatus;
}) => {
  const skip = (filters.page - 1) * filters.limit;
  const query: {
    userId?: Types.ObjectId;
    status?: ReportJobStatus;
  } = {};

  if (filters.userId) {
    query.userId = toObjectId(filters.userId);
  }
  if (filters.status) {
    query.status = filters.status;
  }

  const [jobs, total] = await Promise.all([
    ReportJobModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filters.limit)
      .select("userId weekStart weekEnd status retryCount error.message createdAt updatedAt")
      .lean(),
    ReportJobModel.countDocuments(query),
  ]);

  return {
    jobs: jobs.map((job) => ({
      _id: job._id.toString(),
      userId: job.userId.toString(),
      weekStart: job.weekStart,
      weekEnd: job.weekEnd,
      status: job.status,
      retryCount: job.retryCount,
      error: {
        message: job.error?.message ?? null,
      },
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
