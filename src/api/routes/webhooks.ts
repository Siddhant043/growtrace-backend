import { Router } from "express";

import { handleRazorpayWebhook } from "../controllers/webhooks.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

const webhooksRouter = Router();

webhooksRouter.post("/razorpay", asyncHandler(handleRazorpayWebhook));

export default webhooksRouter;
