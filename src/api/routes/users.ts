import { Router } from "express";

import {
  getCurrentUserPlan,
  getCurrentUserProfile,
  updateCurrentUserPassword,
} from "../controllers/users.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";
import { validateRequest } from "../middlewares/validateRequest";
import { updatePasswordRequestSchema } from "../validators/auth.validator";

const router = Router();

router.get(
  "/me",
  asyncHandler(authenticate),
  asyncHandler(getCurrentUserProfile),
);

router.get(
  "/me/plan",
  asyncHandler(authenticate),
  asyncHandler(getCurrentUserPlan),
);

router.post(
  "/me/password",
  asyncHandler(authenticate),
  validateRequest(updatePasswordRequestSchema),
  asyncHandler(updateCurrentUserPassword),
);

export default router;
