import { Types } from "mongoose";

import {
  WeeklyReportModel,
  type WeeklyReportDocument,
} from "../api/models/weeklyReport.model.js";

type WeeklyReportListFilter = {
  userId: Types.ObjectId;
  weekStart?: { $lt: Date };
};

const DEFAULT_REPORTS_LIST_LIMIT = 12;
const MAX_REPORTS_LIST_LIMIT = 60;

export type WeeklyReportListItemPresentation = {
  weekStart: string;
  weekEnd: string;
  headline: string;
  deltaPct: number;
  isMinimal: boolean;
  isFirstReport: boolean;
  topPlatform: string | null;
  topShortCode: string | null;
  deliveryStatus: string;
};

export type WeeklyReportDetailPresentation = {
  weekStart: string;
  weekEnd: string;
  topPlatform: {
    platform: string | null;
    engagementScore: number;
    clicks: number;
    sessions: number;
  };
  topContent: {
    linkId: string | null;
    shortCode: string | null;
    title: string | null;
    engagementScore: number;
    clicks: number;
  };
  trends: Array<{
    date: string;
    engagementScore: number;
    avgDuration: number;
    bounceRate: number;
    clicks: number;
  }>;
  insights: Array<{
    insightId: string | null;
    type: string;
    message: string;
    confidence: number;
  }>;
  recommendations: Array<{
    insightId: string | null;
    message: string;
    confidence: number;
  }>;
  summary: {
    headline: string;
    deltaPct: number;
    isFirstReport: boolean;
    isMinimal: boolean;
  };
  deliveryStatus: string;
  emailMessageId: string | null;
};

const formatDateAsIsoDateString = (sourceDate: Date): string =>
  sourceDate.toISOString().slice(0, 10);

const mapDocumentToListItem = (
  document: WeeklyReportDocument,
): WeeklyReportListItemPresentation => ({
  weekStart: formatDateAsIsoDateString(document.weekStart),
  weekEnd: formatDateAsIsoDateString(document.weekEnd),
  headline: document.summary?.headline ?? "",
  deltaPct: document.summary?.deltaPct ?? 0,
  isMinimal: document.summary?.isMinimal ?? false,
  isFirstReport: document.summary?.isFirstReport ?? false,
  topPlatform: document.topPlatform?.platform ?? null,
  topShortCode: document.topContent?.shortCode ?? null,
  deliveryStatus: document.deliveryStatus,
});

const mapDocumentToDetailPresentation = (
  document: WeeklyReportDocument,
): WeeklyReportDetailPresentation => ({
  weekStart: formatDateAsIsoDateString(document.weekStart),
  weekEnd: formatDateAsIsoDateString(document.weekEnd),
  topPlatform: {
    platform: document.topPlatform?.platform ?? null,
    engagementScore: document.topPlatform?.engagementScore ?? 0,
    clicks: document.topPlatform?.clicks ?? 0,
    sessions: document.topPlatform?.sessions ?? 0,
  },
  topContent: {
    linkId: document.topContent?.linkId
      ? document.topContent.linkId.toHexString()
      : null,
    shortCode: document.topContent?.shortCode ?? null,
    title: document.topContent?.title ?? null,
    engagementScore: document.topContent?.engagementScore ?? 0,
    clicks: document.topContent?.clicks ?? 0,
  },
  trends: (document.trends ?? []).map((trendBucket) => ({
    date: formatDateAsIsoDateString(trendBucket.date),
    engagementScore: trendBucket.engagementScore,
    avgDuration: trendBucket.avgDuration,
    bounceRate: trendBucket.bounceRate,
    clicks: trendBucket.clicks,
  })),
  insights: (document.insights ?? []).map((entry) => ({
    insightId: entry.insightId ? entry.insightId.toHexString() : null,
    type: entry.type,
    message: entry.message,
    confidence: entry.confidence,
  })),
  recommendations: (document.recommendations ?? []).map((entry) => ({
    insightId: entry.insightId ? entry.insightId.toHexString() : null,
    message: entry.message,
    confidence: entry.confidence,
  })),
  summary: {
    headline: document.summary?.headline ?? "",
    deltaPct: document.summary?.deltaPct ?? 0,
    isFirstReport: document.summary?.isFirstReport ?? false,
    isMinimal: document.summary?.isMinimal ?? false,
  },
  deliveryStatus: document.deliveryStatus,
  emailMessageId: document.emailMessageId ?? null,
});

export type ListWeeklyReportsParameters = {
  userId: string;
  limit?: number;
  beforeIsoDate?: string;
};

export const listWeeklyReportsForUser = async (
  parameters: ListWeeklyReportsParameters,
): Promise<WeeklyReportListItemPresentation[]> => {
  const userObjectId = new Types.ObjectId(parameters.userId);
  const effectiveLimit = Math.min(
    parameters.limit ?? DEFAULT_REPORTS_LIST_LIMIT,
    MAX_REPORTS_LIST_LIMIT,
  );

  const filter: WeeklyReportListFilter = { userId: userObjectId };
  if (parameters.beforeIsoDate) {
    filter.weekStart = {
      $lt: new Date(`${parameters.beforeIsoDate}T00:00:00.000Z`),
    };
  }

  const documents = await WeeklyReportModel.find(filter)
    .sort({ weekStart: -1 })
    .limit(effectiveLimit)
    .lean<WeeklyReportDocument[]>();

  return documents.map(mapDocumentToListItem);
};

export type GetWeeklyReportByWeekStartParameters = {
  userId: string;
  weekStartIsoDate: string;
};

export const getWeeklyReportForUserByWeekStart = async (
  parameters: GetWeeklyReportByWeekStartParameters,
): Promise<WeeklyReportDetailPresentation | null> => {
  const userObjectId = new Types.ObjectId(parameters.userId);
  const weekStartDate = new Date(
    `${parameters.weekStartIsoDate}T00:00:00.000Z`,
  );

  const document = await WeeklyReportModel.findOne({
    userId: userObjectId,
    weekStart: weekStartDate,
  }).lean<WeeklyReportDocument | null>();

  return document ? mapDocumentToDetailPresentation(document) : null;
};

export const getLatestWeeklyReportForUser = async (
  userId: string,
): Promise<WeeklyReportDetailPresentation | null> => {
  const userObjectId = new Types.ObjectId(userId);
  const document = await WeeklyReportModel.findOne({ userId: userObjectId })
    .sort({ weekStart: -1 })
    .lean<WeeklyReportDocument | null>();

  return document ? mapDocumentToDetailPresentation(document) : null;
};
