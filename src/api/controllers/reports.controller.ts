import type { Request, Response } from "express";

import {
  generateAndPersistWeeklyReport,
  type WeeklyReportPayload,
} from "../../services/weeklyReportGenerator.service.js";
import {
  computePreviousIsoWeekWindow,
  computeWeekWindowEndingOnDate,
} from "../../utils/weeklyReports.dateWindow.js";
import {
  getLatestWeeklyReportForUser,
  getWeeklyReportForUserByWeekStart,
  listWeeklyReportsForUser,
} from "../../services/reports.read.service.js";
import type { AuthenticatedRequest } from "../middlewares/authenticate.js";
import type {
  GetReportByWeekStartRequestParams,
  ListReportsRequestQuery,
  PreviewReportRequestBody,
} from "../validators/reports.validator.js";

const getAuthenticatedRequest = (request: Request): AuthenticatedRequest =>
  request as AuthenticatedRequest;

type ApiError = Error & { statusCode: number };

const createApiError = (message: string, statusCode: number): ApiError => {
  const apiError = new Error(message) as ApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

export const getWeeklyReportsList = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const validatedQuery = request.query as unknown as ListReportsRequestQuery;

  const reports = await listWeeklyReportsForUser({
    userId: authenticatedRequest.authenticatedUser.id,
    limit: validatedQuery.limit,
    beforeIsoDate: validatedQuery.before,
  });

  response.status(200).json({
    success: true,
    data: reports,
  });
};

export const getLatestWeeklyReport = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const latestReport = await getLatestWeeklyReportForUser(
    authenticatedRequest.authenticatedUser.id,
  );

  response.status(200).json({
    success: true,
    data: latestReport,
  });
};

export const getWeeklyReportByWeekStart = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const validatedParams =
    request.params as unknown as GetReportByWeekStartRequestParams;

  const report = await getWeeklyReportForUserByWeekStart({
    userId: authenticatedRequest.authenticatedUser.id,
    weekStartIsoDate: validatedParams.weekStart,
  });

  if (!report) {
    throw createApiError("Weekly report not found", 404);
  }

  response.status(200).json({
    success: true,
    data: report,
  });
};

const buildPreviewResponseFromPayload = (
  payload: WeeklyReportPayload,
): Record<string, unknown> => ({
  weekStart: payload.weekStart.toISOString().slice(0, 10),
  weekEnd: payload.weekEnd.toISOString().slice(0, 10),
  topPlatform: payload.topPlatform,
  topContent: {
    linkId: payload.topContent.linkId
      ? payload.topContent.linkId.toHexString()
      : null,
    shortCode: payload.topContent.shortCode,
    title: payload.topContent.title,
    engagementScore: payload.topContent.engagementScore,
    clicks: payload.topContent.clicks,
  },
  trends: payload.trends.map((bucket) => ({
    date: bucket.date.toISOString().slice(0, 10),
    engagementScore: bucket.engagementScore,
    avgDuration: bucket.avgDuration,
    bounceRate: bucket.bounceRate,
    clicks: bucket.clicks,
  })),
  insights: payload.insights.map((entry) => ({
    insightId: entry.insightId ? entry.insightId.toHexString() : null,
    type: entry.type,
    message: entry.message,
    confidence: entry.confidence,
  })),
  recommendations: payload.recommendations.map((entry) => ({
    insightId: entry.insightId ? entry.insightId.toHexString() : null,
    message: entry.message,
    confidence: entry.confidence,
  })),
  summary: payload.summary,
  emailSubject: payload.emailSubject,
  ctaLabel: payload.ctaLabel,
  totalClicks: payload.totalClicks,
  totalSessions: payload.totalSessions,
});

export const previewWeeklyReportForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const validatedBody = (request.body ?? {}) as PreviewReportRequestBody;

  const window = validatedBody.weekEndDate
    ? computeWeekWindowEndingOnDate(validatedBody.weekEndDate)
    : computePreviousIsoWeekWindow();

  const generationResult = await generateAndPersistWeeklyReport({
    userId: authenticatedRequest.authenticatedUser.id,
    window,
  });

  response.status(200).json({
    success: true,
    data: buildPreviewResponseFromPayload(generationResult.payload),
  });
};
