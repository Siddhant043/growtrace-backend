import { Router } from "express";

import {
  getAdminSubscriptionDetailsController,
  listAdminPaymentsController,
  listAdminSubscriptionsController,
  listFailedAdminPaymentsController,
} from "../controllers/adminBilling.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireSuperadmin } from "../middlewares/requireSuperadmin.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  getAdminSubscriptionDetailsRequestSchema,
  listAdminPaymentsRequestSchema,
  listAdminSubscriptionsRequestSchema,
  listFailedPaymentsRequestSchema,
} from "../validators/adminBilling.validator.js";

const adminBillingRouter = Router();

adminBillingRouter.use(authenticate, requireSuperadmin);

adminBillingRouter.get(
  "/subscriptions",
  validateRequest(listAdminSubscriptionsRequestSchema),
  asyncHandler(listAdminSubscriptionsController),
);

adminBillingRouter.get(
  "/subscriptions/:subscriptionId",
  validateRequest(getAdminSubscriptionDetailsRequestSchema),
  asyncHandler(getAdminSubscriptionDetailsController),
);

adminBillingRouter.get(
  "/payments",
  validateRequest(listAdminPaymentsRequestSchema),
  asyncHandler(listAdminPaymentsController),
);

adminBillingRouter.get(
  "/payments/failed",
  validateRequest(listFailedPaymentsRequestSchema),
  asyncHandler(listFailedAdminPaymentsController),
);

export default adminBillingRouter;

