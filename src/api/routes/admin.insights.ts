import { Router } from "express";

import {
  getAdminInsightDetailsController,
  listAdminInsightsController,
  listFailedAdminInsightsController,
  retryAdminInsightJobController,
} from "../controllers/adminInsights.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireSuperadmin } from "../middlewares/requireSuperadmin.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  getAdminInsightDetailsRequestSchema,
  listAdminInsightsRequestSchema,
  listFailedAdminInsightsRequestSchema,
  retryAdminInsightJobRequestSchema,
} from "../validators/adminInsights.validator.js";

const adminInsightsRouter = Router();

adminInsightsRouter.use(authenticate, requireSuperadmin);

adminInsightsRouter.get(
  "/",
  validateRequest(listAdminInsightsRequestSchema),
  asyncHandler(listAdminInsightsController),
);

adminInsightsRouter.get(
  "/failed",
  validateRequest(listFailedAdminInsightsRequestSchema),
  asyncHandler(listFailedAdminInsightsController),
);

adminInsightsRouter.post(
  "/retry/:jobId",
  validateRequest(retryAdminInsightJobRequestSchema),
  asyncHandler(retryAdminInsightJobController),
);

adminInsightsRouter.get(
  "/:insightId",
  validateRequest(getAdminInsightDetailsRequestSchema),
  asyncHandler(getAdminInsightDetailsController),
);

export default adminInsightsRouter;

