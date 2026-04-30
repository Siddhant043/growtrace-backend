import { Router } from "express";

import { handleRazorpayWebhook } from "../controllers/webhooks.controller";
import { asyncHandler } from "../middlewares/asyncHandler";

const webhooksRouter = Router();

webhooksRouter.post("/razorpay", asyncHandler(handleRazorpayWebhook));

export default webhooksRouter;
