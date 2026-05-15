import { Router } from "express";

import {
  getUserInsightDetailsController,
  listUserInsightsController,
} from "../controllers/userInsights.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePlan } from "../middlewares/requirePlan.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  getUserInsightDetailsRequestSchema,
  listUserInsightsRequestSchema,
} from "../validators/userInsights.validator.js";

const insightsRouter = Router();
insightsRouter.use(authenticate, requirePlan("pro"));

insightsRouter.get(
  "/",
  validateRequest(listUserInsightsRequestSchema),
  asyncHandler(listUserInsightsController),
);

insightsRouter.get(
  "/:insightId",
  validateRequest(getUserInsightDetailsRequestSchema),
  asyncHandler(getUserInsightDetailsController),
);

export default insightsRouter;
