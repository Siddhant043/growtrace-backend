import { Router } from "express";

import {
  getCampaignFunnel,
  getLinkFunnel,
  getPlatformFunnel,
  listLinkFunnels,
} from "../controllers/funnel.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";
import { requirePlan } from "../middlewares/requirePlan";
import { validateRequest } from "../middlewares/validateRequest";
import {
  campaignFunnelRequestSchema,
  linkFunnelRequestSchema,
  listLinkFunnelsRequestSchema,
  platformFunnelRequestSchema,
} from "../validators/funnel.validator";

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
