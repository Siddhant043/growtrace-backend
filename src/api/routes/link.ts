import { Router } from "express";

import {
  createShortLink,
  deleteLink,
  getLinkDetails,
  listLinks,
  updateLinkDetails,
} from "../controllers/link.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  createLinkRequestSchema,
  deleteLinkRequestSchema,
  linkByShortCodeRequestSchema,
  listLinksRequestSchema,
  updateLinkRequestSchema,
} from "../validators/link.validator.js";

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
