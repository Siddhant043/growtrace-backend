import { Router } from "express";

import { getAdminDashboardController } from "../controllers/adminDashboard.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireSuperadmin } from "../middlewares/requireSuperadmin.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { getAdminDashboardRequestSchema } from "../validators/adminDashboard.validator.js";

const adminDashboardRouter = Router();

adminDashboardRouter.use(authenticate, requireSuperadmin);

adminDashboardRouter.get(
  "/",
  validateRequest(getAdminDashboardRequestSchema),
  asyncHandler(getAdminDashboardController),
);

export default adminDashboardRouter;
