import { Router } from "express";

import {
  getLatestWeeklyReport,
  getWeeklyReportByWeekStart,
  getWeeklyReportsList,
  previewWeeklyReportForCurrentUser,
} from "../controllers/reports.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePlan } from "../middlewares/requirePlan.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  getReportByWeekStartRequestSchema,
  listReportsRequestSchema,
  previewReportRequestSchema,
} from "../validators/reports.validator.js";

const reportsRouter = Router();
reportsRouter.use(authenticate, requirePlan("pro"));

reportsRouter.get(
  "/",
  validateRequest(listReportsRequestSchema),
  asyncHandler(getWeeklyReportsList),
);

reportsRouter.get("/latest", asyncHandler(getLatestWeeklyReport));

reportsRouter.post(
  "/preview",
  validateRequest(previewReportRequestSchema),
  asyncHandler(previewWeeklyReportForCurrentUser),
);

reportsRouter.get(
  "/:weekStart",
  validateRequest(getReportByWeekStartRequestSchema),
  asyncHandler(getWeeklyReportByWeekStart),
);

export default reportsRouter;
