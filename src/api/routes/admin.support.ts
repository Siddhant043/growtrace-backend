import { Router } from "express";

import {
  getAdminSupportEventDetailsController,
  getAdminUserActivityController,
  listAdminSupportEventsController,
} from "../controllers/adminSupport.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireSuperadmin } from "../middlewares/requireSuperadmin.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  getAdminSupportEventDetailsRequestSchema,
  getAdminUserActivityRequestSchema,
  listAdminSupportEventsRequestSchema,
} from "../validators/adminSupport.validator.js";

const adminSupportRouter = Router();

adminSupportRouter.use(authenticate, requireSuperadmin);

adminSupportRouter.get(
  "/user-activity/:userTrackingId",
  validateRequest(getAdminUserActivityRequestSchema),
  asyncHandler(getAdminUserActivityController),
);

adminSupportRouter.get(
  "/events",
  validateRequest(listAdminSupportEventsRequestSchema),
  asyncHandler(listAdminSupportEventsController),
);

adminSupportRouter.get(
  "/events/:id",
  validateRequest(getAdminSupportEventDetailsRequestSchema),
  asyncHandler(getAdminSupportEventDetailsController),
);

export default adminSupportRouter;
