import { Types } from "mongoose";

import {
  BehaviorEventModel,
  type BehaviorEventType,
} from "../api/models/behaviorEvent.model.js";
import { SessionModel } from "../api/models/session.model.js";
import { redactSensitiveValue } from "../utils/logRedaction.utils.js";

type ServiceApiError = Error & { statusCode: number };

const createServiceApiError = (
  message: string,
  statusCode: number,
): ServiceApiError => {
  const apiError = new Error(message) as ServiceApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

const buildDateRangeFilter = (startDate?: string, endDate?: string) => {
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

export const getAdminUserActivity = async (parameters: {
  userTrackingId: string;
  page: number;
  pageSize: number;
  startDate?: string;
  endDate?: string;
  maxEventsPerSession: number;
}) => {
  const dateRangeFilter = buildDateRangeFilter(
    parameters.startDate,
    parameters.endDate,
  );

  const sessionQuery: {
    userTrackingId: string;
    createdAt?: { $gte: Date; $lte: Date };
  } = {
    userTrackingId: parameters.userTrackingId,
  };
  if (dateRangeFilter) {
    sessionQuery.createdAt = dateRangeFilter;
  }

  const skip = (parameters.page - 1) * parameters.pageSize;
  const [sessions, total] = await Promise.all([
    SessionModel.find(sessionQuery)
      .sort({ lastActivityAt: -1 })
      .skip(skip)
      .limit(parameters.pageSize)
      .lean(),
    SessionModel.countDocuments(sessionQuery),
  ]);

  const sessionIds = sessions.map((session) => session.sessionId);
  const events = sessionIds.length
    ? await BehaviorEventModel.find({
        userTrackingId: parameters.userTrackingId,
        sessionId: { $in: sessionIds },
      })
        .sort({ timestamp: 1 })
        .lean()
    : [];

  const eventsBySessionId = new Map<string, typeof events>();
  for (const event of events) {
    const existingEvents = eventsBySessionId.get(event.sessionId) ?? [];
    if (existingEvents.length < parameters.maxEventsPerSession) {
      existingEvents.push(event);
    }
    eventsBySessionId.set(event.sessionId, existingEvents);
  }

  return {
    sessions: sessions.map((session) => ({
      sessionId: session.sessionId,
      platform: session.platform ?? "unknown",
      duration: session.duration ?? 0,
      startedAt: session.firstVisitAt,
      endedAt: session.lastActivityAt,
      events: (eventsBySessionId.get(session.sessionId) ?? []).map((event) => ({
        _id: event._id.toString(),
        eventType: event.eventType,
        createdAt: event.timestamp,
        metadata: redactSensitiveValue(event.metadata ?? {}),
      })),
    })),
    pagination: {
      total,
      page: parameters.page,
      pageSize: parameters.pageSize,
    },
  };
};

export const listAdminSupportEvents = async (parameters: {
  page: number;
  limit: number;
  userTrackingId?: string;
  sessionId?: string;
  eventType?: BehaviorEventType;
  startDate?: string;
  endDate?: string;
}) => {
  const dateRangeFilter = buildDateRangeFilter(
    parameters.startDate,
    parameters.endDate,
  );
  const skip = (parameters.page - 1) * parameters.limit;
  const query: {
    userTrackingId?: string;
    sessionId?: string;
    eventType?: BehaviorEventType;
    timestamp?: { $gte: Date; $lte: Date };
  } = {};
  if (parameters.userTrackingId) {
    query.userTrackingId = parameters.userTrackingId;
  }
  if (parameters.sessionId) {
    query.sessionId = parameters.sessionId;
  }
  if (parameters.eventType) {
    query.eventType = parameters.eventType;
  }
  if (dateRangeFilter) {
    query.timestamp = dateRangeFilter;
  }

  const [events, total] = await Promise.all([
    BehaviorEventModel.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parameters.limit)
      .lean(),
    BehaviorEventModel.countDocuments(query),
  ]);

  return {
    events: events.map((event) => ({
      _id: event._id.toString(),
      userTrackingId: event.userTrackingId,
      sessionId: event.sessionId,
      eventType: event.eventType,
      linkId: event.linkId instanceof Types.ObjectId ? event.linkId.toString() : null,
      platform: event.platform ?? "unknown",
      metadata: redactSensitiveValue(event.metadata ?? {}),
      createdAt: event.timestamp,
    })),
    pagination: {
      total,
      page: parameters.page,
      limit: parameters.limit,
    },
  };
};

export const getAdminSupportEventDetails = async (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw createServiceApiError("Invalid event id", 400);
  }

  const event = await BehaviorEventModel.findById(id).lean();
  if (!event) {
    throw createServiceApiError("Event not found", 404);
  }

  return {
    _id: event._id.toString(),
    userTrackingId: event.userTrackingId,
    sessionId: event.sessionId,
    eventType: event.eventType,
    linkId: event.linkId instanceof Types.ObjectId ? event.linkId.toString() : null,
    platform: event.platform ?? "unknown",
    page: event.page,
    device: event.device,
    metrics: event.metrics,
    metadata: redactSensitiveValue(event.metadata ?? {}),
    timestamp: event.timestamp,
    createdAt: event.timestamp,
  };
};
