import { Router } from "express";

import {
  getLatestWeeklyReport,
  getWeeklyReportByWeekStart,
  getWeeklyReportsList,
  previewWeeklyReportForCurrentUser,
} from "../controllers/reports.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";
import { validateRequest } from "../middlewares/validateRequest";
import {
  getReportByWeekStartRequestSchema,
  listReportsRequestSchema,
  previewReportRequestSchema,
} from "../validators/reports.validator";

const reportsRouter = Router();

reportsRouter.get(
  "/",
  authenticate,
  validateRequest(listReportsRequestSchema),
  asyncHandler(getWeeklyReportsList),
);

reportsRouter.get(
  "/latest",
  authenticate,
  asyncHandler(getLatestWeeklyReport),
);

reportsRouter.post(
  "/preview",
  authenticate,
  validateRequest(previewReportRequestSchema),
  asyncHandler(previewWeeklyReportForCurrentUser),
);

reportsRouter.get(
  "/:weekStart",
  authenticate,
  validateRequest(getReportByWeekStartRequestSchema),
  asyncHandler(getWeeklyReportByWeekStart),
);

export default reportsRouter;
