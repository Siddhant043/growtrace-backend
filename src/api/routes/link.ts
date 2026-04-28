import { Router } from "express";

import {
  createShortLink,
  deleteLink,
  getLinkDetails,
  listLinks,
  updateLinkDetails,
} from "../controllers/link.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/authenticate";
import { validateRequest } from "../middlewares/validateRequest";
import {
  createLinkRequestSchema,
  deleteLinkRequestSchema,
  linkByShortCodeRequestSchema,
  listLinksRequestSchema,
  updateLinkRequestSchema,
} from "../validators/link.validator";

const linkRouter = Router();

linkRouter.get(
  "/",
  authenticate,
  validateRequest(listLinksRequestSchema),
  asyncHandler(listLinks),
);

linkRouter.post(
  "/",
  authenticate,
  validateRequest(createLinkRequestSchema),
  asyncHandler(createShortLink),
);

linkRouter.get(
  "/:shortCode",
  authenticate,
  validateRequest(linkByShortCodeRequestSchema),
  asyncHandler(getLinkDetails),
);

linkRouter.patch(
  "/:shortCode",
  authenticate,
  validateRequest(updateLinkRequestSchema),
  asyncHandler(updateLinkDetails),
);

linkRouter.delete(
  "/:shortCode",
  authenticate,
  validateRequest(deleteLinkRequestSchema),
  asyncHandler(deleteLink),
);

export default linkRouter;
