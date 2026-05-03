import { Types } from "mongoose";

import {
  BehaviorEventModel,
  type BehaviorEventDocument,
} from "../api/models/behaviorEvent.model.js";
import { SessionModel, type SessionDocument } from "../api/models/session.model.js";
import type { LinkPlatform } from "../api/models/link.model.js";

const DEFAULT_SESSION_LIST_PAGE_SIZE = 20;
const MAX_SESSION_LIST_PAGE_SIZE = 100;

export type SessionListItem = {
  sessionId: string;
  linkId: string | null;
  platform: string | null;
  campaign: string | null;
  firstClickAt: string | null;
  firstVisitAt: string;
  lastActivityAt: string;
  duration: number;
  maxScrollDepth: number;
  isBounce: boolean;
  isReturning: boolean;
  entryUrl: string;
  referrer: string;
  country: string;
  deviceType: string;
  browser: string;
  createdAt: string;
  updatedAt: string;
};

export type SessionsListFilters = {
  linkId: string | null;
  platform: string | null;
  campaign: string | null;
  fromDate: string | null;
  toDate: string | null;
};

export type SessionsListResponse = {
  items: SessionListItem[];
  total: number;
  page: number;
  pageSize: number;
  filters: SessionsListFilters;
};

export type BehaviorEventListItem = {
  eventType: string;
  timestamp: string;
  pageUrl: string;
  pageReferrer: string;
  scrollDepth: number | null;
  duration: number | null;
};

export type SessionDetailResponse = {
  session: SessionListItem;
  behaviorEvents: BehaviorEventListItem[];
};

export type ListSessionsServiceParams = {
  linkId?: string;
  platform?: LinkPlatform;
  campaign?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
};

const formatDateAsIsoStringOrNull = (
  dateValue: Date | null | undefined,
): string | null => {
  if (!dateValue) {
    return null;
  }
  return dateValue.toISOString();
};

const mapSessionDocumentToListItem = (
  sessionDocument: SessionDocument,
): SessionListItem => ({
  sessionId: sessionDocument.sessionId,
  linkId: sessionDocument.linkId ? sessionDocument.linkId.toString() : null,
  platform: sessionDocument.platform ?? null,
  campaign: sessionDocument.campaign ?? null,
  firstClickAt: formatDateAsIsoStringOrNull(sessionDocument.firstClickAt),
  firstVisitAt: sessionDocument.firstVisitAt.toISOString(),
  lastActivityAt: sessionDocument.lastActivityAt.toISOString(),
  duration: sessionDocument.duration,
  maxScrollDepth: sessionDocument.maxScrollDepth,
  isBounce: sessionDocument.isBounce,
  isReturning: sessionDocument.isReturning,
  entryUrl: sessionDocument.entryUrl,
  referrer: sessionDocument.referrer,
  country: sessionDocument.country,
  deviceType: sessionDocument.deviceType,
  browser: sessionDocument.browser,
  createdAt: (sessionDocument as SessionDocument & { createdAt: Date }).createdAt.toISOString(),
  updatedAt: (sessionDocument as SessionDocument & { updatedAt: Date }).updatedAt.toISOString(),
});

const mapBehaviorEventDocumentToListItem = (
  behaviorEventDocument: BehaviorEventDocument,
): BehaviorEventListItem => ({
  eventType: behaviorEventDocument.eventType,
  timestamp: behaviorEventDocument.timestamp.toISOString(),
  pageUrl: behaviorEventDocument.page?.url ?? "",
  pageReferrer: behaviorEventDocument.page?.referrer ?? "",
  scrollDepth: behaviorEventDocument.metrics?.scrollDepth ?? null,
  duration: behaviorEventDocument.metrics?.duration ?? null,
});

const buildIsoDateBoundaryStart = (isoDate: string): Date =>
  new Date(`${isoDate}T00:00:00.000Z`);

const buildIsoDateBoundaryEndExclusive = (isoDate: string): Date => {
  const inclusiveEnd = new Date(`${isoDate}T00:00:00.000Z`);
  inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() + 1);
  return inclusiveEnd;
};

const buildSessionsListMongoFilter = (
  userId: string,
  params: ListSessionsServiceParams,
): Record<string, unknown> => {
  const filterQuery: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
  };

  if (params.linkId && Types.ObjectId.isValid(params.linkId)) {
    filterQuery.linkId = new Types.ObjectId(params.linkId);
  }

  if (params.platform) {
    filterQuery.platform = params.platform;
  }

  if (params.campaign) {
    filterQuery.campaign = params.campaign;
  }

  const createdAtConstraint: Record<string, Date> = {};
  if (params.fromDate) {
    createdAtConstraint.$gte = buildIsoDateBoundaryStart(params.fromDate);
  }
  if (params.toDate) {
    createdAtConstraint.$lt = buildIsoDateBoundaryEndExclusive(params.toDate);
  }
  if (Object.keys(createdAtConstraint).length > 0) {
    filterQuery.createdAt = createdAtConstraint;
  }

  return filterQuery;
};

const clampPageNumber = (rawPageNumber: number | undefined): number => {
  if (typeof rawPageNumber !== "number" || rawPageNumber < 1) {
    return 1;
  }
  return Math.floor(rawPageNumber);
};

const clampPageSize = (rawPageSize: number | undefined): number => {
  if (typeof rawPageSize !== "number" || rawPageSize < 1) {
    return DEFAULT_SESSION_LIST_PAGE_SIZE;
  }
  return Math.min(MAX_SESSION_LIST_PAGE_SIZE, Math.floor(rawPageSize));
};

export const listSessionsForUser = async (
  userId: string,
  params: ListSessionsServiceParams,
): Promise<SessionsListResponse> => {
  const resolvedPage = clampPageNumber(params.page);
  const resolvedPageSize = clampPageSize(params.pageSize);
  const mongoFilter = buildSessionsListMongoFilter(userId, params);

  const [sessionDocuments, totalCount] = await Promise.all([
    SessionModel.find(mongoFilter)
      .sort({ createdAt: -1 })
      .skip((resolvedPage - 1) * resolvedPageSize)
      .limit(resolvedPageSize)
      .lean<SessionDocument[]>(),
    SessionModel.countDocuments(mongoFilter),
  ]);

  return {
    items: sessionDocuments.map(mapSessionDocumentToListItem),
    total: totalCount,
    page: resolvedPage,
    pageSize: resolvedPageSize,
    filters: {
      linkId: params.linkId ?? null,
      platform: params.platform ?? null,
      campaign: params.campaign ?? null,
      fromDate: params.fromDate ?? null,
      toDate: params.toDate ?? null,
    },
  };
};

export const getSessionDetailForUser = async (
  userId: string,
  sessionId: string,
): Promise<SessionDetailResponse | null> => {
  const sessionDocument = await SessionModel.findOne({
    sessionId,
    userId: new Types.ObjectId(userId),
  }).lean<SessionDocument>();

  if (!sessionDocument) {
    return null;
  }

  const behaviorEventDocuments = await BehaviorEventModel.find({
    sessionId,
    userId: new Types.ObjectId(userId),
  })
    .sort({ timestamp: 1 })
    .lean<BehaviorEventDocument[]>();

  return {
    session: mapSessionDocumentToListItem(sessionDocument),
    behaviorEvents: behaviorEventDocuments.map(
      mapBehaviorEventDocumentToListItem,
    ),
  };
};
