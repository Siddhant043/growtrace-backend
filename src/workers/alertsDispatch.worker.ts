import type { Job, Worker } from "bullmq";
import { Types } from "mongoose";

import { env } from "../config/env.js";
import {
  AlertModel,
  type AlertChannel,
  type AlertDocument,
  type AlertType,
} from "../api/models/alert.model.js";
import { UserModel } from "../api/models/user.model.js";
import { sendAlertEmail } from "../infrastructure/email.js";
import {
  createAlertsDispatchWorker,
  type AlertsDispatchJobPayload,
} from "../infrastructure/queue.js";
import {
  getNotificationPreferencesForUser,
  resolveDispatchChannelsForAlert,
  type NormalizedNotificationPreferences,
} from "../services/alertPreferences.service.js";
import { publishInAppNotification } from "../services/notificationGateway.service.js";
import type { AlertEmailViewModel } from "../templates/alert.email.js";

interface AlertsDispatchJobOutcome {
  alertId: string | null;
  status: "created" | "deduped" | "skipped_preferences" | "skipped_unknown_user";
  emailStatus: "sent" | "skipped" | "failed" | "pending";
}

const buildSupportingPointsForAlert = (
  payload: AlertsDispatchJobPayload,
): Array<{ label: string; value: string }> => {
  const supportingPoints: Array<{ label: string; value: string }> = [];

  if (payload.type === "engagement_drop") {
    supportingPoints.push({
      label: "Today",
      value: `${String(payload.metadata.todayAvgEngagement ?? "—")} avg engagement`,
    });
    supportingPoints.push({
      label: "Yesterday",
      value: `${String(payload.metadata.yesterdayAvgEngagement ?? "—")} avg engagement`,
    });
    supportingPoints.push({
      label: "Change",
      value: `-${String(payload.metadata.changePercent ?? 0)}%`,
    });
  } else if (payload.type === "traffic_spike") {
    supportingPoints.push({
      label: "Platform",
      value: String(payload.metadata.platform ?? "—"),
    });
    supportingPoints.push({
      label: "Today's sessions",
      value: String(payload.metadata.todaySessions ?? "—"),
    });
    supportingPoints.push({
      label: "7-day baseline",
      value: `${String(payload.metadata.baselineAvgSessions ?? "—")}/day`,
    });
    supportingPoints.push({
      label: "Lift",
      value: `+${String(payload.metadata.liftPercent ?? 0)}%`,
    });
  } else if (payload.type === "top_link") {
    supportingPoints.push({
      label: "Short code",
      value: String(payload.metadata.shortCode ?? "—"),
    });
    supportingPoints.push({
      label: "Engagement score",
      value: String(payload.metadata.engagementScore ?? "—"),
    });
    if (payload.metadata.platform) {
      supportingPoints.push({
        label: "Platform",
        value: String(payload.metadata.platform),
      });
    }
  }

  return supportingPoints;
};

const buildAlertEmailViewModel = (
  alertDocument: AlertDocument,
  payload: AlertsDispatchJobPayload,
  recipientFirstName: string | null,
): AlertEmailViewModel => {
  const baseClientUrl = env.CLIENT_APP_URL.replace(/\/$/, "");
  const ctaUrl = `${baseClientUrl}${payload.deepLinkPath}`;
  const manageNotificationsUrl = `${baseClientUrl}/settings/notifications`;

  return {
    alertType: payload.type as AlertType,
    recipientFirstName,
    headline: alertDocument.headline,
    message: alertDocument.message,
    supportingPoints: buildSupportingPointsForAlert(payload),
    ctaUrl,
    ctaLabel: "View analytics",
    manageNotificationsUrl,
    occurredAt: alertDocument.occurredAt as Date,
  };
};

interface UserContactInfo {
  email: string;
  fullName: string | null;
  firstName: string | null;
}

const loadUserContactInfo = async (
  userId: string,
): Promise<UserContactInfo | null> => {
  if (!Types.ObjectId.isValid(userId)) {
    return null;
  }

  const userDocument = await UserModel.findById(userId)
    .select({ email: 1, fullName: 1, isDeleted: 1 })
    .lean();

  if (!userDocument || userDocument.isDeleted) {
    return null;
  }

  const trimmedFullName =
    typeof userDocument.fullName === "string"
      ? userDocument.fullName.trim()
      : "";
  const firstName = trimmedFullName.length > 0
    ? trimmedFullName.split(/\s+/)[0]
    : null;

  return {
    email: userDocument.email,
    fullName: trimmedFullName.length > 0 ? trimmedFullName : null,
    firstName,
  };
};

const sendAlertEmailWithRetry = async (
  alertDocument: AlertDocument,
  payload: AlertsDispatchJobPayload,
  contactInfo: UserContactInfo,
): Promise<{ status: "sent" | "failed"; errorMessage?: string }> => {
  try {
    const viewModel = buildAlertEmailViewModel(
      alertDocument,
      payload,
      contactInfo.firstName,
    );

    await sendAlertEmail({
      recipientEmail: contactInfo.email,
      recipientFullName: contactInfo.fullName,
      viewModel,
    });

    return { status: "sent" };
  } catch (sendError) {
    const errorMessage =
      sendError instanceof Error ? sendError.message : String(sendError);
    return { status: "failed", errorMessage };
  }
};

interface MongoDuplicateKeyError extends Error {
  code: number;
}

const isMongoDuplicateKeyError = (
  candidate: unknown,
): candidate is MongoDuplicateKeyError =>
  candidate instanceof Error &&
  "code" in candidate &&
  (candidate as MongoDuplicateKeyError).code === 11000;

const upsertAlertDocument = async (
  payload: AlertsDispatchJobPayload,
  channels: AlertChannel[],
): Promise<{ alertDocument: AlertDocument; isFreshlyCreated: boolean }> => {
  const occurredAtDate = new Date(payload.occurredAtMs);
  const initialEmailStatus = channels.includes("email") ? "pending" : "skipped";

  try {
    const createdAlertDocument = await AlertModel.create({
      userId: new Types.ObjectId(payload.userId),
      type: payload.type,
      headline: payload.headline,
      message: payload.message,
      metadata: payload.metadata,
      channels,
      emailStatus: initialEmailStatus,
      isRead: false,
      dedupeKey: payload.dedupeKey,
      source: payload.source,
      deepLinkPath: payload.deepLinkPath,
      occurredAt: occurredAtDate,
    });

    return { alertDocument: createdAlertDocument, isFreshlyCreated: true };
  } catch (createError) {
    if (!isMongoDuplicateKeyError(createError)) {
      throw createError;
    }

    const existingAlertDocument = await AlertModel.findOne({
      dedupeKey: payload.dedupeKey,
    });
    if (!existingAlertDocument) {
      throw new Error(
        "[alertsDispatch.worker] dedup hit but matching alert not found",
      );
    }

    return {
      alertDocument: existingAlertDocument,
      isFreshlyCreated: false,
    };
  }
};

export const processAlertsDispatchJob = async (
  job: Job<AlertsDispatchJobPayload>,
): Promise<AlertsDispatchJobOutcome> => {
  const payload = job.data;

  const userPreferences: NormalizedNotificationPreferences =
    await getNotificationPreferencesForUser(payload.userId);

  const dispatchChannels = resolveDispatchChannelsForAlert(
    userPreferences,
    payload.type as AlertType,
  );

  if (dispatchChannels.length === 0) {
    return {
      alertId: null,
      status: "skipped_preferences",
      emailStatus: "skipped",
    };
  }

  const { alertDocument, isFreshlyCreated } = await upsertAlertDocument(
    payload,
    dispatchChannels,
  );

  if (!isFreshlyCreated) {
    return {
      alertId: alertDocument._id.toString(),
      status: "deduped",
      emailStatus: alertDocument.emailStatus as AlertsDispatchJobOutcome["emailStatus"],
    };
  }

  await publishInAppNotification(payload.userId, alertDocument);

  if (!dispatchChannels.includes("email")) {
    await AlertModel.updateOne(
      { _id: alertDocument._id },
      { $set: { emailStatus: "skipped" } },
    );
    return {
      alertId: alertDocument._id.toString(),
      status: "created",
      emailStatus: "skipped",
    };
  }

  const contactInfo = await loadUserContactInfo(payload.userId);
  if (!contactInfo) {
    await AlertModel.updateOne(
      { _id: alertDocument._id },
      { $set: { emailStatus: "skipped" } },
    );
    return {
      alertId: alertDocument._id.toString(),
      status: "skipped_unknown_user",
      emailStatus: "skipped",
    };
  }

  const emailDeliveryResult = await sendAlertEmailWithRetry(
    alertDocument,
    payload,
    contactInfo,
  );

  if (emailDeliveryResult.status === "sent") {
    await AlertModel.updateOne(
      { _id: alertDocument._id },
      { $set: { emailStatus: "sent" } },
    );
    return {
      alertId: alertDocument._id.toString(),
      status: "created",
      emailStatus: "sent",
    };
  }

  await AlertModel.updateOne(
    { _id: alertDocument._id },
    {
      $set: {
        emailStatus: "failed",
        emailError: emailDeliveryResult.errorMessage ?? "unknown",
      },
    },
  );

  return {
    alertId: alertDocument._id.toString(),
    status: "created",
    emailStatus: "failed",
  };
};

export const startAlertsDispatchWorker =
  (): Worker<AlertsDispatchJobPayload> => {
    const worker = createAlertsDispatchWorker(processAlertsDispatchJob);

    worker.on("failed", (failedJob, failureError) => {
      console.error("[alertsDispatch.worker] Job failed", {
        jobId: failedJob?.id,
        attemptsMade: failedJob?.attemptsMade,
        error: failureError,
      });
    });

    worker.on("error", (workerError) => {
      console.error("[alertsDispatch.worker] Worker error", workerError);
    });

    return worker;
  };
