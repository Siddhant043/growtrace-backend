import { Router } from "express";

import {
  cancelSubscriptionForCurrentUser,
  createSubscriptionForCurrentUser,
  getSubscriptionPortalForCurrentUser,
} from "../controllers/payments.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  cancelSubscriptionRequestSchema,
  createSubscriptionRequestSchema,
} from "../validators/payments.validator.js";

const paymentsRouter = Router();

paymentsRouter.post(
  "/create-subscription",
  asyncHandler(authenticate),
  validateRequest(createSubscriptionRequestSchema),
  asyncHandler(createSubscriptionForCurrentUser),
);

paymentsRouter.post(
  "/cancel",
  asyncHandler(authenticate),
  validateRequest(cancelSubscriptionRequestSchema),
  asyncHandler(cancelSubscriptionForCurrentUser),
);

paymentsRouter.get(
  "/portal",
  asyncHandler(authenticate),
  asyncHandler(getSubscriptionPortalForCurrentUser),
);

export default paymentsRouter;
