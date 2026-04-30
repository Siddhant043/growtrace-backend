import { Router } from "express";

import {
  getLatestWeeklyReport,
  getWeeklyReportByWeekStart,
  getWeeklyReportsList,
  previewWeeklyReportForCurrentUser,
} from "../controllers/reports.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";
import { requirePlan } from "../middlewares/requirePlan";
import { validateRequest } from "../middlewares/validateRequest";
import {
  getReportByWeekStartRequestSchema,
  listReportsRequestSchema,
  previewReportRequestSchema,
} from "../validators/reports.validator";

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
