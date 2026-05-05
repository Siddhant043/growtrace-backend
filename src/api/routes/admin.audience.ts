import { Router } from "express";

import {
  getAdminAudienceCohortsController,
  getAdminAudienceSegmentsController,
} from "../controllers/adminAudience.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireSuperadmin } from "../middlewares/requireSuperadmin.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  getAdminAudienceCohortsRequestSchema,
  getAdminAudienceSegmentsRequestSchema,
} from "../validators/adminAudience.validator.js";

const adminAudienceRouter = Router();

adminAudienceRouter.use(authenticate, requireSuperadmin);

adminAudienceRouter.get(
  "/segments",
  validateRequest(getAdminAudienceSegmentsRequestSchema),
  asyncHandler(getAdminAudienceSegmentsController),
);

adminAudienceRouter.get(
  "/cohorts",
  validateRequest(getAdminAudienceCohortsRequestSchema),
  asyncHandler(getAdminAudienceCohortsController),
);

export default adminAudienceRouter;
