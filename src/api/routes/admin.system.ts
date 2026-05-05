import { Router } from "express";

import {
  getAdminSystemErrorDetailsController,
  listAdminSystemErrorsController,
  listAdminSystemQueuesController,
  listAdminSystemWorkersController,
} from "../controllers/adminSystem.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireSuperadmin } from "../middlewares/requireSuperadmin.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  getAdminSystemErrorDetailsRequestSchema,
  listAdminSystemErrorsRequestSchema,
  listAdminSystemQueuesRequestSchema,
  listAdminSystemWorkersRequestSchema,
} from "../validators/adminSystem.validator.js";

const adminSystemRouter = Router();

adminSystemRouter.use(authenticate, requireSuperadmin);

adminSystemRouter.get(
  "/queues",
  validateRequest(listAdminSystemQueuesRequestSchema),
  asyncHandler(listAdminSystemQueuesController),
);

adminSystemRouter.get(
  "/workers",
  validateRequest(listAdminSystemWorkersRequestSchema),
  asyncHandler(listAdminSystemWorkersController),
);

adminSystemRouter.get(
  "/errors",
  validateRequest(listAdminSystemErrorsRequestSchema),
  asyncHandler(listAdminSystemErrorsController),
);

adminSystemRouter.get(
  "/errors/:id",
  validateRequest(getAdminSystemErrorDetailsRequestSchema),
  asyncHandler(getAdminSystemErrorDetailsController),
);

export default adminSystemRouter;
