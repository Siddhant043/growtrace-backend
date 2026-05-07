import { Types } from "mongoose";

import { AlertModel, type AlertType } from "../api/models/alert.model.js";
import { AlertRuleModel } from "../api/models/alertRule.model.js";
import { env } from "../config/env.js";

type ServiceApiError = Error & { statusCode: number };

const createServiceApiError = (
  message: string,
  statusCode: number,
): ServiceApiError => {
  const apiError = new Error(message) as ServiceApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

const resolveDefaultThresholdsForType = (type: AlertType) => {
  if (type === "engagement_drop") {
    return {
      dropPercent: Number(
        ((1 - env.ALERTS_ENGAGEMENT_DROP_THRESHOLD) * 100).toFixed(2),
      ),
      spikeMultiplier: null,
    };
  }
  if (type === "traffic_spike") {
    return {
      dropPercent: null,
      spikeMultiplier: env.ALERTS_TRAFFIC_SPIKE_MULTIPLIER,
    };
  }
  return {
    dropPercent: null,
    spikeMultiplier: null,
  };
};

export const listAdminAlerts = async (filters: {
  page: number;
  limit: number;
  type?: AlertType;
  userId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: "createdAt" | "type";
  sortOrder?: "asc" | "desc";
}) => {
  const skip = (filters.page - 1) * filters.limit;
  const sortDirection = filters.sortOrder === "asc" ? 1 : -1;
  const alertsSort: Record<string, 1 | -1> = {};
  if (filters.sortBy === "type") {
    alertsSort.type = sortDirection;
    alertsSort.createdAt = -1;
  } else {
    alertsSort.createdAt = sortDirection;
  }
  const query: {
    type?: AlertType;
    userId?: Types.ObjectId;
    createdAt?: { $gte?: Date; $lte?: Date };
  } = {};

  if (filters.type) {
    query.type = filters.type;
  }
  if (filters.userId && Types.ObjectId.isValid(filters.userId)) {
    query.userId = new Types.ObjectId(filters.userId);
  }
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) {
      query.createdAt.$gte = new Date(`${filters.startDate}T00:00:00.000Z`);
    }
    if (filters.endDate) {
      query.createdAt.$lte = new Date(`${filters.endDate}T23:59:59.999Z`);
    }
  }

  const [alerts, total, groupedCounts] = await Promise.all([
    AlertModel.find(query)
      .sort(alertsSort)
      .skip(skip)
      .limit(filters.limit)
      .lean(),
    AlertModel.countDocuments(query),
    AlertModel.aggregate<{ _id: AlertType; count: number }>([
      { $match: query },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
  ]);

  const countsByType = groupedCounts.reduce<Record<string, number>>(
    (accumulator, row) => {
      accumulator[row._id] = row.count;
      return accumulator;
    },
    {},
  );

  return {
    alerts: alerts.map((alert) => ({
      _id: alert._id.toString(),
      userId: alert.userId.toString(),
      type: alert.type,
      headline: alert.headline,
      message: alert.message,
      isRead: alert.isRead,
      channels: alert.channels,
      createdAt: alert.createdAt,
    })),
    pagination: {
      total,
      page: filters.page,
      limit: filters.limit,
    },
    summary: {
      total,
      countsByType,
    },
  };
};

export const getAdminAlertDetails = async (alertId: string) => {
  const alert = await AlertModel.findById(alertId).lean();
  if (!alert) {
    throw createServiceApiError("Alert not found", 404);
  }

  return {
    _id: alert._id.toString(),
    userId: alert.userId.toString(),
    type: alert.type,
    headline: alert.headline,
    message: alert.message,
    metadata: alert.metadata ?? null,
    channels: alert.channels,
    isRead: alert.isRead,
    emailStatus: alert.emailStatus,
    createdAt: alert.createdAt,
    occurredAt: alert.occurredAt,
  };
};

export const listAdminAlertSettings = async () => {
  const ruleTypes: AlertType[] = ["engagement_drop", "traffic_spike", "top_link"];
  const persistedRules = await AlertRuleModel.find({})
    .sort({ type: 1 })
    .lean();

  return ruleTypes.map((type) => {
    const persistedRule = persistedRules.find((rule) => rule.type === type);
    return {
      type,
      enabled: persistedRule?.enabled ?? true,
      thresholds:
        persistedRule?.thresholds ?? resolveDefaultThresholdsForType(type),
      cooldownHours: persistedRule?.cooldownHours ?? env.ALERTS_DEDUP_WINDOW_HOURS,
      updatedAt: persistedRule?.updatedAt ?? null,
    };
  });
};

export const updateAdminAlertSettings = async (
  type: AlertType,
  update: {
    enabled?: boolean;
    thresholds?: { dropPercent?: number; spikeMultiplier?: number };
    cooldownHours?: number;
  },
) => {
  if (type === "engagement_drop" && update.thresholds?.spikeMultiplier !== undefined) {
    throw createServiceApiError(
      "spikeMultiplier is not supported for engagement_drop",
      400,
    );
  }
  if (type === "traffic_spike" && update.thresholds?.dropPercent !== undefined) {
    throw createServiceApiError(
      "dropPercent is not supported for traffic_spike",
      400,
    );
  }

  const updatePayload: {
    enabled?: boolean;
    cooldownHours?: number;
    "thresholds.dropPercent"?: number;
    "thresholds.spikeMultiplier"?: number;
  } = {};

  if (update.enabled !== undefined) {
    updatePayload.enabled = update.enabled;
  }
  if (update.cooldownHours !== undefined) {
    updatePayload.cooldownHours = update.cooldownHours;
  }
  if (update.thresholds?.dropPercent !== undefined) {
    updatePayload["thresholds.dropPercent"] = update.thresholds.dropPercent;
  }
  if (update.thresholds?.spikeMultiplier !== undefined) {
    updatePayload["thresholds.spikeMultiplier"] =
      update.thresholds.spikeMultiplier;
  }

  await AlertRuleModel.updateOne(
    { type },
    {
      $set: updatePayload,
      $setOnInsert: {
        type,
      },
    },
    { upsert: true },
  );

  const updatedRule = await AlertRuleModel.findOne({ type }).lean();
  if (!updatedRule) {
    throw createServiceApiError("Failed to update alert settings", 500);
  }

  return {
    type: updatedRule.type,
    enabled: updatedRule.enabled,
    thresholds: updatedRule.thresholds,
    cooldownHours: updatedRule.cooldownHours,
    updatedAt: updatedRule.updatedAt,
  };
};

