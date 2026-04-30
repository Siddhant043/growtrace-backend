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
} from "../controllers/analytics.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";
import { validateRequest } from "../middlewares/validateRequest";
import {
  contentPerformanceRequestSchema,
  engagementTrendsRequestSchema,
  platformQualityRequestSchema,
} from "../validators/analytics.validator";

const analyticsRouter = Router();

analyticsRouter.get("/overview", authenticate, asyncHandler(getAnalyticsOverview));
analyticsRouter.get("/platform", authenticate, asyncHandler(getAnalyticsPlatformStats));
analyticsRouter.get("/links", authenticate, asyncHandler(getAnalyticsTopLinks));
analyticsRouter.get("/trends", authenticate, asyncHandler(getAnalyticsTrends));
analyticsRouter.get("/compare", authenticate, asyncHandler(getAnalyticsComparison));

analyticsRouter.get(
  "/engagement-trends",
  authenticate,
  validateRequest(engagementTrendsRequestSchema),
  asyncHandler(getEngagementTrends),
);

analyticsRouter.get(
  "/platform-quality",
  authenticate,
  validateRequest(platformQualityRequestSchema),
  asyncHandler(getPlatformQuality),
);

analyticsRouter.get(
  "/content-performance",
  authenticate,
  validateRequest(contentPerformanceRequestSchema),
  asyncHandler(getContentPerformance),
);

export default analyticsRouter;
