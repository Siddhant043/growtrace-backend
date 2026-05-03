import { Router } from "express";

import {
  getAttributionJourneyDetailForCurrentUser,
  getAttributionRecentJourneysForCurrentUser,
  getAttributionSummaryForCurrentUser,
} from "../controllers/attribution.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePlan } from "../middlewares/requirePlan.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  getAttributionJourneyDetailRequestSchema,
  getAttributionRecentJourneysRequestSchema,
  getAttributionSummaryRequestSchema,
} from "../validators/attribution.validator.js";

const attributionRouter = Router();
attributionRouter.use(authenticate, requirePlan("pro"));

attributionRouter.get(
  "/summary",
  validateRequest(getAttributionSummaryRequestSchema),
  asyncHandler(getAttributionSummaryForCurrentUser),
);

attributionRouter.get(
  "/journeys",
  validateRequest(getAttributionRecentJourneysRequestSchema),
  asyncHandler(getAttributionRecentJourneysForCurrentUser),
);

attributionRouter.get(
  "/journey/:userTrackingId",
  validateRequest(getAttributionJourneyDetailRequestSchema),
  asyncHandler(getAttributionJourneyDetailForCurrentUser),
);

export default attributionRouter;
