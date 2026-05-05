import { Router } from "express";

import {
  listAdminFunnelMetricsController,
  listAdminPlatformMetricsController,
  listAdminUsageMetricsController,
} from "../controllers/adminAnalytics.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireSuperadmin } from "../middlewares/requireSuperadmin.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  listAdminFunnelMetricsRequestSchema,
  listAdminPlatformMetricsRequestSchema,
  listAdminUsageMetricsRequestSchema,
} from "../validators/adminAnalytics.validator.js";

const adminAnalyticsRouter = Router();

adminAnalyticsRouter.use(authenticate, requireSuperadmin);

adminAnalyticsRouter.get(
  "/platform",
  validateRequest(listAdminPlatformMetricsRequestSchema),
  asyncHandler(listAdminPlatformMetricsController),
);

adminAnalyticsRouter.get(
  "/usage",
  validateRequest(listAdminUsageMetricsRequestSchema),
  asyncHandler(listAdminUsageMetricsController),
);

adminAnalyticsRouter.get(
  "/funnel",
  validateRequest(listAdminFunnelMetricsRequestSchema),
  asyncHandler(listAdminFunnelMetricsController),
);

export default adminAnalyticsRouter;

