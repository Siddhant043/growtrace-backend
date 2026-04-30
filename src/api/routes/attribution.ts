import { Router } from "express";

import {
  getAttributionJourneyDetailForCurrentUser,
  getAttributionRecentJourneysForCurrentUser,
  getAttributionSummaryForCurrentUser,
} from "../controllers/attribution.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";
import { validateRequest } from "../middlewares/validateRequest";
import {
  getAttributionJourneyDetailRequestSchema,
  getAttributionRecentJourneysRequestSchema,
  getAttributionSummaryRequestSchema,
} from "../validators/attribution.validator";

const attributionRouter = Router();

attributionRouter.get(
  "/summary",
  authenticate,
  validateRequest(getAttributionSummaryRequestSchema),
  asyncHandler(getAttributionSummaryForCurrentUser),
);

attributionRouter.get(
  "/journeys",
  authenticate,
  validateRequest(getAttributionRecentJourneysRequestSchema),
  asyncHandler(getAttributionRecentJourneysForCurrentUser),
);

attributionRouter.get(
  "/journey/:userTrackingId",
  authenticate,
  validateRequest(getAttributionJourneyDetailRequestSchema),
  asyncHandler(getAttributionJourneyDetailForCurrentUser),
);

export default attributionRouter;
