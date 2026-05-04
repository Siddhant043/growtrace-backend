import { Router } from "express";

import {
  getAnalyticsComparison,
  getAnalyticsOverview,
  getAnalyticsPlatformStats,
  getAnalyticsTrends,
  getAnalyticsTopLinks,
  getContentPerformance,
  getEngagementTrends,
  getPlatformQuality,
} from "../controllers/analytics.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePlan } from "../middlewares/requirePlan.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  contentPerformanceRequestSchema,
  engagementTrendsRequestSchema,
  platformQualityRequestSchema,
} from "../validators/analytics.validator.js";

const analyticsRouter = Router();

analyticsRouter.get("/overview", authenticate, asyncHandler(getAnalyticsOverview));
analyticsRouter.get("/platform", authenticate, asyncHandler(getAnalyticsPlatformStats));
analyticsRouter.get("/links", authenticate, asyncHandler(getAnalyticsTopLinks));
analyticsRouter.get("/trends", authenticate, asyncHandler(getAnalyticsTrends));
analyticsRouter.get("/compare", authenticate, asyncHandler(getAnalyticsComparison));

analyticsRouter.get(
  "/engagement-trends",
  authenticate,
  requirePlan("pro"),
  validateRequest(engagementTrendsRequestSchema),
  asyncHandler(getEngagementTrends),
);

analyticsRouter.get(
  "/platform-quality",
  authenticate,
  requirePlan("pro"),
  validateRequest(platformQualityRequestSchema),
  asyncHandler(getPlatformQuality),
);

analyticsRouter.get(
  "/content-performance",
  authenticate,
  requirePlan("pro"),
  validateRequest(contentPerformanceRequestSchema),
  asyncHandler(getContentPerformance),
);

export default analyticsRouter;
