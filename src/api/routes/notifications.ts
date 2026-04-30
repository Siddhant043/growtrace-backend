import { Router } from "express";

import {
  deleteNotificationForCurrentUser,
  getNotificationPreferencesForCurrentUser,
  getNotificationsUnreadCountForCurrentUser,
  listNotificationsForCurrentUser,
  markAllNotificationsReadForCurrentUser,
  markNotificationReadForCurrentUser,
  updateNotificationPreferencesForCurrentUser,
} from "../controllers/notifications.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";
import { validateRequest } from "../middlewares/validateRequest";
import {
  deleteNotificationRequestSchema,
  getNotificationPreferencesRequestSchema,
  getNotificationsUnreadCountRequestSchema,
  listNotificationsRequestSchema,
  markAllNotificationsReadRequestSchema,
  markNotificationReadRequestSchema,
  updateNotificationPreferencesRequestSchema,
} from "../validators/notifications.validator";

const notificationsRouter = Router();

notificationsRouter.get(
  "/",
  authenticate,
  validateRequest(listNotificationsRequestSchema),
  asyncHandler(listNotificationsForCurrentUser),
);

notificationsRouter.get(
  "/unread-count",
  authenticate,
  validateRequest(getNotificationsUnreadCountRequestSchema),
  asyncHandler(getNotificationsUnreadCountForCurrentUser),
);

notificationsRouter.patch(
  "/read-all",
  authenticate,
  validateRequest(markAllNotificationsReadRequestSchema),
  asyncHandler(markAllNotificationsReadForCurrentUser),
);

notificationsRouter.patch(
  "/:id/read",
  authenticate,
  validateRequest(markNotificationReadRequestSchema),
  asyncHandler(markNotificationReadForCurrentUser),
);

notificationsRouter.delete(
  "/:id",
  authenticate,
  validateRequest(deleteNotificationRequestSchema),
  asyncHandler(deleteNotificationForCurrentUser),
);

notificationsRouter.get(
  "/preferences",
  authenticate,
  validateRequest(getNotificationPreferencesRequestSchema),
  asyncHandler(getNotificationPreferencesForCurrentUser),
);

notificationsRouter.put(
  "/preferences",
  authenticate,
  validateRequest(updateNotificationPreferencesRequestSchema),
  asyncHandler(updateNotificationPreferencesForCurrentUser),
);

export default notificationsRouter;
