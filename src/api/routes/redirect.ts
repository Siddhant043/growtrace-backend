import { Router } from "express";

import { redirectUsingShortCode } from "../controllers/redirect.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

const redirectRouter = Router();

redirectRouter.get("/r/:shortCode", asyncHandler(redirectUsingShortCode));

export default redirectRouter;
