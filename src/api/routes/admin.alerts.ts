import { Router } from "express";

import {
  getAdminAlertDetailsController,
  listAdminAlertsController,
  listAdminAlertSettingsController,
  updateAdminAlertSettingsController,
} from "../controllers/adminAlerts.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireSuperadmin } from "../middlewares/requireSuperadmin.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  getAdminAlertDetailsRequestSchema,
  listAdminAlertsRequestSchema,
  listAdminAlertSettingsRequestSchema,
  updateAdminAlertSettingsRequestSchema,
} from "../validators/adminAlerts.validator.js";

const adminAlertsRouter = Router();

adminAlertsRouter.use(authenticate, requireSuperadmin);

adminAlertsRouter.get(
  "/",
  validateRequest(listAdminAlertsRequestSchema),
  asyncHandler(listAdminAlertsController),
);

adminAlertsRouter.get(
  "/settings",
  validateRequest(listAdminAlertSettingsRequestSchema),
  asyncHandler(listAdminAlertSettingsController),
);

adminAlertsRouter.patch(
  "/settings/:type",
  validateRequest(updateAdminAlertSettingsRequestSchema),
  asyncHandler(updateAdminAlertSettingsController),
);

adminAlertsRouter.get(
  "/:alertId",
  validateRequest(getAdminAlertDetailsRequestSchema),
  asyncHandler(getAdminAlertDetailsController),
);

export default adminAlertsRouter;

