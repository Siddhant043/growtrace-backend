import { Router } from "express";

import {
  getSessionDetail,
  listSessions,
} from "../controllers/session.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";
import { validateRequest } from "../middlewares/validateRequest";
import {
  getSessionDetailRequestSchema,
  listSessionsRequestSchema,
} from "../validators/session.validator";

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
