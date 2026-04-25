import { Router } from "express";

import {
  getAnalyticsComparison,
  getAnalyticsOverview,
  getAnalyticsPlatformStats,
  getAnalyticsTrends,
  getAnalyticsTopLinks,
} from "../controllers/analytics.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";

const analyticsRouter = Router();

analyticsRouter.get("/overview", authenticate, asyncHandler(getAnalyticsOverview));
analyticsRouter.get("/platform", authenticate, asyncHandler(getAnalyticsPlatformStats));
analyticsRouter.get("/links", authenticate, asyncHandler(getAnalyticsTopLinks));
analyticsRouter.get("/trends", authenticate, asyncHandler(getAnalyticsTrends));
analyticsRouter.get("/compare", authenticate, asyncHandler(getAnalyticsComparison));

export default analyticsRouter;
