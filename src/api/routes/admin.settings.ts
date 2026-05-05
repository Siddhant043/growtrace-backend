import { Router } from "express";

import {
  getEmailTemplateDetailsController,
  listEmailTemplatesController,
  listFeatureFlagsController,
  listNotificationSettingsController,
  previewEmailTemplateController,
  updateEmailTemplateController,
  updateFeatureFlagController,
  updateNotificationSettingsController,
} from "../controllers/adminSettings.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireSuperadmin } from "../middlewares/requireSuperadmin.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  getEmailTemplateDetailsRequestSchema,
  listEmailTemplatesRequestSchema,
  listFeatureFlagsRequestSchema,
  listNotificationSettingsRequestSchema,
  previewEmailTemplateRequestSchema,
  updateEmailTemplateRequestSchema,
  updateFeatureFlagRequestSchema,
  updateNotificationSettingsRequestSchema,
} from "../validators/adminSettings.validator.js";

const adminSettingsRouter = Router();

adminSettingsRouter.use(authenticate, requireSuperadmin);

adminSettingsRouter.get(
  "/feature-flags",
  validateRequest(listFeatureFlagsRequestSchema),
  asyncHandler(listFeatureFlagsController),
);
adminSettingsRouter.patch(
  "/feature-flags/:key",
  validateRequest(updateFeatureFlagRequestSchema),
  asyncHandler(updateFeatureFlagController),
);

adminSettingsRouter.get(
  "/email-templates",
  validateRequest(listEmailTemplatesRequestSchema),
  asyncHandler(listEmailTemplatesController),
);
adminSettingsRouter.get(
  "/email-templates/:key",
  validateRequest(getEmailTemplateDetailsRequestSchema),
  asyncHandler(getEmailTemplateDetailsController),
);
adminSettingsRouter.patch(
  "/email-templates/:key",
  validateRequest(updateEmailTemplateRequestSchema),
  asyncHandler(updateEmailTemplateController),
);
adminSettingsRouter.post(
  "/email-templates/:key/preview",
  validateRequest(previewEmailTemplateRequestSchema),
  asyncHandler(previewEmailTemplateController),
);

adminSettingsRouter.get(
  "/notifications",
  validateRequest(listNotificationSettingsRequestSchema),
  asyncHandler(listNotificationSettingsController),
);
adminSettingsRouter.patch(
  "/notifications/:type",
  validateRequest(updateNotificationSettingsRequestSchema),
  asyncHandler(updateNotificationSettingsController),
);

export default adminSettingsRouter;
