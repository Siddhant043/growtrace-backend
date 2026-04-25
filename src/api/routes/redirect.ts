import { Router } from "express";

import { redirectUsingShortCode } from "../controllers/redirect.controller";
import { asyncHandler } from "../middlewares/asyncHandler";

const redirectRouter = Router();

redirectRouter.get("/r/:shortCode", asyncHandler(redirectUsingShortCode));

export default redirectRouter;
