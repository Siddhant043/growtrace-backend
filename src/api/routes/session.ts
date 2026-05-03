import { Router } from "express";

import {
  getSessionDetail,
  listSessions,
} from "../controllers/session.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  getSessionDetailRequestSchema,
  listSessionsRequestSchema,
} from "../validators/session.validator.js";

const sessionRouter = Router();

sessionRouter.get(
  "/",
  authenticate,
  validateRequest(listSessionsRequestSchema),
  asyncHandler(listSessions),
);

sessionRouter.get(
  "/:sessionId",
  authenticate,
  validateRequest(getSessionDetailRequestSchema),
  asyncHandler(getSessionDetail),
);

export default sessionRouter;
