import { Router } from "express";

import {
  getAudienceCohortsForCurrentUser,
  getAudienceEngagementHistogramForCurrentUser,
  getAudienceInsightsForCurrentUser,
  getAudienceSegmentsForCurrentUser,
  getAudienceUsersForCurrentUser,
} from "../controllers/audience.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePlan } from "../middlewares/requirePlan.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  getAudienceCohortsRequestSchema,
  getAudienceEngagementHistogramRequestSchema,
  getAudienceInsightsRequestSchema,
  getAudienceSegmentsRequestSchema,
  getAudienceUsersRequestSchema,
} from "../validators/audience.validator.js";

const audienceRouter = Router();
audienceRouter.use(authenticate, requirePlan("pro"));

audienceRouter.get(
  "/segments",
  validateRequest(getAudienceSegmentsRequestSchema),
  asyncHandler(getAudienceSegmentsForCurrentUser),
);

audienceRouter.get(
  "/cohorts",
  validateRequest(getAudienceCohortsRequestSchema),
  asyncHandler(getAudienceCohortsForCurrentUser),
);

audienceRouter.get(
  "/users",
  validateRequest(getAudienceUsersRequestSchema),
  asyncHandler(getAudienceUsersForCurrentUser),
);

audienceRouter.get(
  "/insights",
  validateRequest(getAudienceInsightsRequestSchema),
  asyncHandler(getAudienceInsightsForCurrentUser),
);

audienceRouter.get(
  "/engagement-histogram",
  validateRequest(getAudienceEngagementHistogramRequestSchema),
  asyncHandler(getAudienceEngagementHistogramForCurrentUser),
);

export default audienceRouter;
