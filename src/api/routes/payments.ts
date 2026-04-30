import { Router } from "express";

import {
  cancelSubscriptionForCurrentUser,
  createSubscriptionForCurrentUser,
  getSubscriptionPortalForCurrentUser,
} from "../controllers/payments.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";
import { validateRequest } from "../middlewares/validateRequest";
import {
  cancelSubscriptionRequestSchema,
  createSubscriptionRequestSchema,
} from "../validators/payments.validator";

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
