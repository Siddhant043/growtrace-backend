import { Types } from "mongoose";

import {
  ALERT_TYPES,
  AlertModel,
  type AlertDocument,
  type AlertType,
} from "../api/models/alert.model.js";

export interface AlertListItem {
  id: string;
  type: AlertType;
  headline: string;
  message: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  channels: string[];
  emailStatus: string;
  deepLinkPath: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface ListAlertsForUserParameters {
  userId: string;
  unreadOnly?: boolean;
  type?: AlertType | "all";
  limit?: number;
  cursor?: string | null;
}

export interface ListAlertsForUserResult {
  items: AlertListItem[];
  nextCursor: string | null;
}

interface AlertMongoFilter {
  userId: Types.ObjectId;
  isRead?: boolean;
  type?: AlertType;
  createdAt?: { $lt: Date };
}

const toAlertListItem = (alertDocument: AlertDocument): AlertListItem => ({
  id: alertDocument._id.toString(),
  type: alertDocument.type as AlertType,
  headline: alertDocument.headline,
  message: alertDocument.message,
  metadata:
    (alertDocument.metadata as Record<string, unknown> | null | undefined) ??
    null,
  isRead: Boolean(alertDocument.isRead),
  channels: Array.isArray(alertDocument.channels)
    ? alertDocument.channels.map((channelValue) => String(channelValue))
    : [],
  emailStatus: String(alertDocument.emailStatus ?? "skipped"),
  deepLinkPath: alertDocument.deepLinkPath ?? null,
  occurredAt:
    alertDocument.occurredAt instanceof Date
      ? alertDocument.occurredAt.toISOString()
      : new Date(alertDocument.occurredAt as string).toISOString(),
  createdAt:
    alertDocument.createdAt instanceof Date
      ? alertDocument.createdAt.toISOString()
      : new Date(alertDocument.createdAt as string).toISOString(),
});

const isValidAlertType = (
  candidate: string | undefined,
): candidate is AlertType => {
  if (!candidate) return false;
  return (ALERT_TYPES as readonly string[]).includes(candidate);
};

export const listAlertsForUser = async (
  parameters: ListAlertsForUserParameters,
): Promise<ListAlertsForUserResult> => {
  if (!Types.ObjectId.isValid(parameters.userId)) {
    return { items: [], nextCursor: null };
  }

  const limit = Math.min(Math.max(parameters.limit ?? 20, 1), 100);
  const filter: AlertMongoFilter = {
    userId: new Types.ObjectId(parameters.userId),
  };

  if (parameters.unreadOnly === true) {
    filter.isRead = false;
  }

  if (parameters.type && parameters.type !== "all") {
    if (isValidAlertType(parameters.type)) {
      filter.type = parameters.type;
    }
  }

  if (parameters.cursor) {
    const cursorDate = new Date(parameters.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      filter.createdAt = { $lt: cursorDate };
    }
  }

  const alertDocuments = await AlertModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean<AlertDocument[]>();

  const hasNextPage = alertDocuments.length > limit;
  const visibleAlertDocuments = hasNextPage
    ? alertDocuments.slice(0, limit)
    : alertDocuments;

  const items = visibleAlertDocuments.map(toAlertListItem);
  const lastItem = visibleAlertDocuments[visibleAlertDocuments.length - 1];
  const nextCursor =
    hasNextPage && lastItem
      ? new Date(lastItem.createdAt as Date).toISOString()
      : null;

  return { items, nextCursor };
};

export const countUnreadAlertsForUser = async (
  userId: string,
): Promise<number> => {
  if (!Types.ObjectId.isValid(userId)) {
    return 0;
  }

  return AlertModel.countDocuments({
    userId: new Types.ObjectId(userId),
    isRead: false,
  });
};

export const markAlertAsReadForUser = async (
  userId: string,
  alertId: string,
): Promise<AlertListItem | null> => {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(alertId)) {
    return null;
  }

  const updatedAlert = await AlertModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(alertId),
      userId: new Types.ObjectId(userId),
    },
    { $set: { isRead: true } },
    { new: true },
  ).lean<AlertDocument | null>();

  if (!updatedAlert) {
    return null;
  }

  return toAlertListItem(updatedAlert);
};

export const markAllAlertsAsReadForUser = async (
  userId: string,
): Promise<{ modifiedCount: number }> => {
  if (!Types.ObjectId.isValid(userId)) {
    return { modifiedCount: 0 };
  }

  const updateResult = await AlertModel.updateMany(
    {
      userId: new Types.ObjectId(userId),
      isRead: false,
    },
    { $set: { isRead: true } },
  );

  return { modifiedCount: updateResult.modifiedCount ?? 0 };
};

export const deleteAlertForUser = async (
  userId: string,
  alertId: string,
): Promise<{ deleted: boolean }> => {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(alertId)) {
    return { deleted: false };
  }

  const deleteResult = await AlertModel.deleteOne({
    _id: new Types.ObjectId(alertId),
    userId: new Types.ObjectId(userId),
  });

  return { deleted: (deleteResult.deletedCount ?? 0) > 0 };
};
