import type { AlertDocument } from "../api/models/alert.model.js";

/**
 * Stub gateway for real-time notification delivery. Today this is a no-op
 * (clients poll `/api/notifications/unread-count`); the abstraction is in
 * place so that a WebSocket / SSE / push transport can be plugged in later
 * without touching the dispatch worker.
 */
export const publishInAppNotification = async (
  userId: string,
  alertDocument: AlertDocument,
): Promise<void> => {
  if (process.env.NOTIFICATION_GATEWAY_DEBUG === "true") {
    console.info("[notificationGateway] publishInAppNotification (no-op)", {
      userId,
      alertId: alertDocument._id.toString(),
      type: alertDocument.type,
    });
  }
};
