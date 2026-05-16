import { Router } from "express";

import {
  getCampaignFunnel,
  getFunnelDailySeries,
  getFunnelOverview,
  getLinkFunnel,
  getPlatformFunnel,
  listLinkFunnels,
  listPlatformFunnels,
} from "../controllers/funnel.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePlan } from "../middlewares/requirePlan.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  campaignFunnelRequestSchema,
  funnelDailySeriesRequestSchema,
  funnelOverviewRequestSchema,
  linkFunnelRequestSchema,
  listLinkFunnelsRequestSchema,
  listPlatformFunnelsRequestSchema,
  platformFunnelRequestSchema,
} from "../validators/funnel.validator.js";

const funnelRouter = Router();
funnelRouter.use(authenticate, requirePlan("pro"));

funnelRouter.get(
  "/overview",
  validateRequest(funnelOverviewRequestSchema),
  asyncHandler(getFunnelOverview),
);

funnelRouter.get(
  "/daily-series",
  validateRequest(funnelDailySeriesRequestSchema),
  asyncHandler(getFunnelDailySeries),
);

funnelRouter.get(
  "/platforms",
  validateRequest(listPlatformFunnelsRequestSchema),
  asyncHandler(listPlatformFunnels),
);

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
