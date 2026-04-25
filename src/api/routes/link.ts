import { Router } from "express";

import { createShortLink } from "../controllers/link.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";
import { validateRequest } from "../middlewares/validateRequest";
import { createLinkRequestSchema } from "../validators/link.validator";

const linkRouter = Router();

linkRouter.post(
  "/",
  authenticate,
  validateRequest(createLinkRequestSchema),
  asyncHandler(createShortLink),
);

export default linkRouter;
