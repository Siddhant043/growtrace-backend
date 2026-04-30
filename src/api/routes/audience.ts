import { Router } from "express";

import {
  getAudienceCohortsForCurrentUser,
  getAudienceEngagementHistogramForCurrentUser,
  getAudienceInsightsForCurrentUser,
  getAudienceSegmentsForCurrentUser,
  getAudienceUsersForCurrentUser,
} from "../controllers/audience.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";
import { validateRequest } from "../middlewares/validateRequest";
import {
  getAudienceCohortsRequestSchema,
  getAudienceEngagementHistogramRequestSchema,
  getAudienceInsightsRequestSchema,
  getAudienceSegmentsRequestSchema,
  getAudienceUsersRequestSchema,
} from "../validators/audience.validator";

const audienceRouter = Router();

audienceRouter.get(
  "/segments",
  authenticate,
  validateRequest(getAudienceSegmentsRequestSchema),
  asyncHandler(getAudienceSegmentsForCurrentUser),
);

audienceRouter.get(
  "/cohorts",
  authenticate,
  validateRequest(getAudienceCohortsRequestSchema),
  asyncHandler(getAudienceCohortsForCurrentUser),
);

audienceRouter.get(
  "/users",
  authenticate,
  validateRequest(getAudienceUsersRequestSchema),
  asyncHandler(getAudienceUsersForCurrentUser),
);

audienceRouter.get(
  "/insights",
  authenticate,
  validateRequest(getAudienceInsightsRequestSchema),
  asyncHandler(getAudienceInsightsForCurrentUser),
);

audienceRouter.get(
  "/engagement-histogram",
  authenticate,
  validateRequest(getAudienceEngagementHistogramRequestSchema),
  asyncHandler(getAudienceEngagementHistogramForCurrentUser),
);

export default audienceRouter;
