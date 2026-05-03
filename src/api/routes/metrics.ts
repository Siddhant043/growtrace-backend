import { Router } from "express";

import {
  getCampaignMetrics,
  getLinkMetrics,
  getPlatformMetrics,
  listLinkMetrics,
} from "../controllers/metrics.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  campaignMetricsRequestSchema,
  linkMetricsRequestSchema,
  listLinkMetricsRequestSchema,
  platformMetricsRequestSchema,
} from "../validators/metrics.validator.js";

const metricsRouter = Router();

metricsRouter.get(
  "/links",
  authenticate,
  validateRequest(listLinkMetricsRequestSchema),
  asyncHandler(listLinkMetrics),
);

metricsRouter.get(
  "/link/:linkId",
  authenticate,
  validateRequest(linkMetricsRequestSchema),
  asyncHandler(getLinkMetrics),
);

metricsRouter.get(
  "/platform/:platform",
  authenticate,
  validateRequest(platformMetricsRequestSchema),
  asyncHandler(getPlatformMetrics),
);

metricsRouter.get(
  "/campaign/:campaign",
  authenticate,
  validateRequest(campaignMetricsRequestSchema),
  asyncHandler(getCampaignMetrics),
);

export default metricsRouter;
