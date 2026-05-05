import { Router } from "express";

import {
  getAdminUserDetailController,
  listAdminUsersController,
  listSuspendedAdminUsersController,
  updateAdminUserPlanController,
  updateAdminUserStatusController,
} from "../controllers/adminUsers.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireSuperadmin } from "../middlewares/requireSuperadmin.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  getAdminUserDetailRequestSchema,
  listAdminUsersRequestSchema,
  updateAdminUserPlanRequestSchema,
  updateAdminUserStatusRequestSchema,
} from "../validators/adminUsers.validator.js";

const adminUsersRouter = Router();

adminUsersRouter.use(authenticate, requireSuperadmin);

adminUsersRouter.get(
  "/",
  validateRequest(listAdminUsersRequestSchema),
  asyncHandler(listAdminUsersController),
);

adminUsersRouter.get(
  "/suspended",
  validateRequest(listAdminUsersRequestSchema),
  asyncHandler(listSuspendedAdminUsersController),
);

adminUsersRouter.get(
  "/:userId",
  validateRequest(getAdminUserDetailRequestSchema),
  asyncHandler(getAdminUserDetailController),
);

adminUsersRouter.patch(
  "/:userId/status",
  validateRequest(updateAdminUserStatusRequestSchema),
  asyncHandler(updateAdminUserStatusController),
);

adminUsersRouter.patch(
  "/:userId/plan",
  validateRequest(updateAdminUserPlanRequestSchema),
  asyncHandler(updateAdminUserPlanController),
);

export default adminUsersRouter;

