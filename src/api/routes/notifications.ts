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
import { requirePlan } from "../middlewares/requirePlan";
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
notificationsRouter.use(authenticate, requirePlan("pro"));

notificationsRouter.get(
  "/",
  validateRequest(listNotificationsRequestSchema),
  asyncHandler(listNotificationsForCurrentUser),
);

notificationsRouter.get(
  "/unread-count",
  validateRequest(getNotificationsUnreadCountRequestSchema),
  asyncHandler(getNotificationsUnreadCountForCurrentUser),
);

notificationsRouter.patch(
  "/read-all",
  validateRequest(markAllNotificationsReadRequestSchema),
  asyncHandler(markAllNotificationsReadForCurrentUser),
);

notificationsRouter.patch(
  "/:id/read",
  validateRequest(markNotificationReadRequestSchema),
  asyncHandler(markNotificationReadForCurrentUser),
);

notificationsRouter.delete(
  "/:id",
  validateRequest(deleteNotificationRequestSchema),
  asyncHandler(deleteNotificationForCurrentUser),
);

notificationsRouter.get(
  "/preferences",
  validateRequest(getNotificationPreferencesRequestSchema),
  asyncHandler(getNotificationPreferencesForCurrentUser),
);

notificationsRouter.put(
  "/preferences",
  validateRequest(updateNotificationPreferencesRequestSchema),
  asyncHandler(updateNotificationPreferencesForCurrentUser),
);

export default notificationsRouter;
