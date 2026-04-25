import { Router } from "express";

import {
  getAnalyticsOverview,
  getAnalyticsPlatformStats,
  getAnalyticsTopLinks,
} from "../controllers/analytics.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";

const analyticsRouter = Router();

analyticsRouter.get("/overview", authenticate, asyncHandler(getAnalyticsOverview));
analyticsRouter.get("/platform", authenticate, asyncHandler(getAnalyticsPlatformStats));
analyticsRouter.get("/links", authenticate, asyncHandler(getAnalyticsTopLinks));

export default analyticsRouter;
