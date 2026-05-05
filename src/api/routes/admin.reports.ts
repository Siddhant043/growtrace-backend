import { Router } from "express";

import {
  getAdminReportDetailsController,
  listAdminReportHistoryController,
  listAdminReportJobsController,
  listAdminReportsController,
  triggerAdminReportGenerationController,
} from "../controllers/adminReports.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireSuperadmin } from "../middlewares/requireSuperadmin.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  getAdminReportDetailsRequestSchema,
  listAdminReportHistoryRequestSchema,
  listAdminReportJobsRequestSchema,
  listAdminReportsRequestSchema,
  triggerAdminReportGenerationRequestSchema,
} from "../validators/adminReports.validator.js";

const adminReportsRouter = Router();

adminReportsRouter.use(authenticate, requireSuperadmin);

adminReportsRouter.get(
  "/",
  validateRequest(listAdminReportsRequestSchema),
  asyncHandler(listAdminReportsController),
);

adminReportsRouter.get(
  "/jobs",
  validateRequest(listAdminReportJobsRequestSchema),
  asyncHandler(listAdminReportJobsController),
);

adminReportsRouter.get(
  "/history/:userId",
  validateRequest(listAdminReportHistoryRequestSchema),
  asyncHandler(listAdminReportHistoryController),
);

adminReportsRouter.post(
  "/generate/:userId",
  validateRequest(triggerAdminReportGenerationRequestSchema),
  asyncHandler(triggerAdminReportGenerationController),
);

adminReportsRouter.get(
  "/:id",
  validateRequest(getAdminReportDetailsRequestSchema),
  asyncHandler(getAdminReportDetailsController),
);

export default adminReportsRouter;
