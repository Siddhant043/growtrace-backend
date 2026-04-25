import { Router } from "express";

import { getDashboard } from "../controllers/dashboard.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";

const dashboardRouter = Router();

dashboardRouter.get("/", authenticate, asyncHandler(getDashboard));

export default dashboardRouter;
