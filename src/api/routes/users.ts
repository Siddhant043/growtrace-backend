import { Router } from "express";

import {
  getCurrentUserPlan,
  getCurrentUserProfile,
  submitMyFeedbackController,
  updateCurrentUserCountry,
  updateCurrentUserPassword,
} from "../controllers/users.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { updatePasswordRequestSchema } from "../validators/auth.validator.js";
import { submitMyFeedbackRequestSchema } from "../validators/userFeedback.validator.js";
import { updateUserCountryRequestSchema } from "../validators/userCountry.validator.js";

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

router.patch(
  "/me/country",
  asyncHandler(authenticate),
  validateRequest(updateUserCountryRequestSchema),
  asyncHandler(updateCurrentUserCountry),
);

router.post(
  "/me/password",
  asyncHandler(authenticate),
  validateRequest(updatePasswordRequestSchema),
  asyncHandler(updateCurrentUserPassword),
);

router.post(
  "/me/feedback",
  asyncHandler(authenticate),
  validateRequest(submitMyFeedbackRequestSchema),
  asyncHandler(submitMyFeedbackController),
);

export default router;
