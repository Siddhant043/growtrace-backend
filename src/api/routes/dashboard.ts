import { Router } from "express";

import { getDashboard } from "../controllers/dashboard.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";

const dashboardRouter = Router();

dashboardRouter.get("/", authenticate, asyncHandler(getDashboard));

export default dashboardRouter;
