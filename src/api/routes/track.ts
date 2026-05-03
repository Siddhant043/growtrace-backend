import { Router } from "express";
import cors from "cors";

import { ingestTrackingEvent } from "../controllers/track.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { trackEventRequestSchema } from "../validators/track.validator.js";

const trackRouter = Router();

trackRouter.use(
  cors({
    origin: true,
    methods: ["POST", "OPTIONS"],
    maxAge: 600,
    credentials: false,
  }),
);

trackRouter.options("/", (_request, response) => {
  response.sendStatus(204);
});

trackRouter.post(
  "/",
  validateRequest(trackEventRequestSchema),
  asyncHandler(ingestTrackingEvent),
);

export default trackRouter;
