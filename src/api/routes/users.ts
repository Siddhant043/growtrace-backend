import { Router } from "express";

import { getCurrentUserProfile } from "../controllers/users.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";

const router = Router();

router.get(
  "/me",
  asyncHandler(authenticate),
  asyncHandler(getCurrentUserProfile),
);

export default router;
