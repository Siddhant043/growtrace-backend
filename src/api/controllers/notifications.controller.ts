import type { Request, Response } from "express";

import { ALERT_TYPES, type AlertType } from "../models/alert.model";
import {
  countUnreadAlertsForUser,
  deleteAlertForUser,
  listAlertsForUser,
  markAlertAsReadForUser,
  markAllAlertsAsReadForUser,
} from "../../services/alertRead.service";
import {
  getNotificationPreferencesForUser,
  upsertNotificationPreferencesForUser,
} from "../../services/alertPreferences.service";
import type { AuthenticatedRequest } from "../middlewares/authenticate";
import type {
  DeleteNotificationRequestParams,
  ListNotificationsRequestQuery,
  MarkNotificationReadRequestParams,
  UpdateNotificationPreferencesRequestBody,
} from "../validators/notifications.validator";

const requireAuthenticatedUserId = (request: Request): string => {
  const authenticatedUser = (request as AuthenticatedRequest).authenticatedUser;
  if (!authenticatedUser) {
    const authError = new Error("Not authenticated") as Error & {
      statusCode: number;
    };
    authError.statusCode = 401;
    throw authError;
  }
  return authenticatedUser.id;
};

const isValidAlertTypeParam = (
  candidate: string,
): candidate is AlertType | "all" =>
  candidate === "all" || (ALERT_TYPES as readonly string[]).includes(candidate);

export const listNotificationsForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUserId = requireAuthenticatedUserId(request);
  const validatedQuery = request.query as unknown as
    | ListNotificationsRequestQuery
    | undefined;

  const requestedTypeRaw = validatedQuery?.type ?? "all";
  const requestedType: AlertType | "all" = isValidAlertTypeParam(
    requestedTypeRaw,
  )
    ? requestedTypeRaw
    : "all";

  const result = await listAlertsForUser({
    userId: authenticatedUserId,
    unreadOnly: validatedQuery?.unreadOnly ?? false,
    type: requestedType,
    limit: validatedQuery?.limit ?? 20,
    cursor: validatedQuery?.cursor ?? null,
  });

  response.status(200).json({ success: true, data: result });
};

export const getNotificationsUnreadCountForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUserId = requireAuthenticatedUserId(request);
  const unreadCount = await countUnreadAlertsForUser(authenticatedUserId);

  response
    .status(200)
    .json({ success: true, data: { unreadCount } });
};

export const markNotificationReadForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUserId = requireAuthenticatedUserId(request);
  const validatedParams = request.params as unknown as
    | MarkNotificationReadRequestParams
    | undefined;
  const targetAlertId = validatedParams?.id ?? "";

  const updatedItem = await markAlertAsReadForUser(
    authenticatedUserId,
    targetAlertId,
  );

  if (!updatedItem) {
    response
      .status(404)
      .json({ success: false, message: "Notification not found" });
    return;
  }

  response.status(200).json({ success: true, data: updatedItem });
};

export const markAllNotificationsReadForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUserId = requireAuthenticatedUserId(request);
  const updateResult = await markAllAlertsAsReadForUser(authenticatedUserId);

  response.status(200).json({ success: true, data: updateResult });
};

export const deleteNotificationForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUserId = requireAuthenticatedUserId(request);
  const validatedParams = request.params as unknown as
    | DeleteNotificationRequestParams
    | undefined;
  const targetAlertId = validatedParams?.id ?? "";

  const deleteResult = await deleteAlertForUser(
    authenticatedUserId,
    targetAlertId,
  );

  if (!deleteResult.deleted) {
    response
      .status(404)
      .json({ success: false, message: "Notification not found" });
    return;
  }

  response.status(200).json({ success: true, data: deleteResult });
};

export const getNotificationPreferencesForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUserId = requireAuthenticatedUserId(request);
  const preferences =
    await getNotificationPreferencesForUser(authenticatedUserId);

  response.status(200).json({ success: true, data: preferences });
};

export const updateNotificationPreferencesForCurrentUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedUserId = requireAuthenticatedUserId(request);
  const validatedBody =
    request.body as UpdateNotificationPreferencesRequestBody;

  const updatedPreferences = await upsertNotificationPreferencesForUser(
    authenticatedUserId,
    {
      emailEnabled: validatedBody.emailEnabled,
      inAppEnabled: validatedBody.inAppEnabled,
      types: validatedBody.types,
    },
  );

  response.status(200).json({ success: true, data: updatedPreferences });
};
