import { Router } from "express";

import {
  getAttributionJourneyDetailForCurrentUser,
  getAttributionRecentJourneysForCurrentUser,
  getAttributionSummaryForCurrentUser,
} from "../controllers/attribution.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";
import { requirePlan } from "../middlewares/requirePlan";
import { validateRequest } from "../middlewares/validateRequest";
import {
  getAttributionJourneyDetailRequestSchema,
  getAttributionRecentJourneysRequestSchema,
  getAttributionSummaryRequestSchema,
} from "../validators/attribution.validator";

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
