import { Router } from "express";

import {
  getCampaignFunnel,
  getLinkFunnel,
  getPlatformFunnel,
  listLinkFunnels,
} from "../controllers/funnel.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePlan } from "../middlewares/requirePlan.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  campaignFunnelRequestSchema,
  linkFunnelRequestSchema,
  listLinkFunnelsRequestSchema,
  platformFunnelRequestSchema,
} from "../validators/funnel.validator.js";

const funnelRouter = Router();
funnelRouter.use(authenticate, requirePlan("pro"));

funnelRouter.get(
  "/links",
  validateRequest(listLinkFunnelsRequestSchema),
  asyncHandler(listLinkFunnels),
);

funnelRouter.get(
  "/link/:linkId",
  validateRequest(linkFunnelRequestSchema),
  asyncHandler(getLinkFunnel),
);

funnelRouter.get(
  "/platform/:platform",
  validateRequest(platformFunnelRequestSchema),
  asyncHandler(getPlatformFunnel),
);

funnelRouter.get(
  "/campaign/:campaign",
  validateRequest(campaignFunnelRequestSchema),
  asyncHandler(getCampaignFunnel),
);

export default funnelRouter;
