import { Router } from "express";

import {
  getCampaignFunnel,
  getLinkFunnel,
  getPlatformFunnel,
  listLinkFunnels,
} from "../controllers/funnel.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";
import { validateRequest } from "../middlewares/validateRequest";
import {
  campaignFunnelRequestSchema,
  linkFunnelRequestSchema,
  listLinkFunnelsRequestSchema,
  platformFunnelRequestSchema,
} from "../validators/funnel.validator";

const funnelRouter = Router();

funnelRouter.get(
  "/links",
  authenticate,
  validateRequest(listLinkFunnelsRequestSchema),
  asyncHandler(listLinkFunnels),
);

funnelRouter.get(
  "/link/:linkId",
  authenticate,
  validateRequest(linkFunnelRequestSchema),
  asyncHandler(getLinkFunnel),
);

funnelRouter.get(
  "/platform/:platform",
  authenticate,
  validateRequest(platformFunnelRequestSchema),
  asyncHandler(getPlatformFunnel),
);

funnelRouter.get(
  "/campaign/:campaign",
  authenticate,
  validateRequest(campaignFunnelRequestSchema),
  asyncHandler(getCampaignFunnel),
);

export default funnelRouter;
