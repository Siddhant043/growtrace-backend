import type { Request, Response } from "express";

import { LinkModel } from "../models/link.model";
import { logClick } from "../../services/tracking.service";
import { enqueueAttributionTouchpoint } from "../../services/attributionProducer.service";
import { appendTrackingParam } from "../utils/appendTrackingParam";
import { isLikelyBot } from "../utils/isLikelyBot";
import { ensureUserTrackingIdOnResponse } from "../utils/userTrackingCookie";

type ApiError = Error & { statusCode: number };

const createApiError = (message: string, statusCode: number): ApiError => {
  const apiError = new Error(message) as ApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

export const redirectUsingShortCode = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const shortCodeParameter = request.params.shortCode;
  const requestedShortCode =
    typeof shortCodeParameter === "string" ? shortCodeParameter.trim() : "";

  if (!requestedShortCode) {
    throw createApiError("shortCode is required", 400);
  }

  const link = await LinkModel.findOne({ shortCode: requestedShortCode });
  if (!link) {
    throw createApiError("Short link not found", 404);
  }

  const requesterUserAgent = request.get("user-agent");
  const requesterIsLikelyBot = isLikelyBot(requesterUserAgent);

  const clickTimestamp = new Date();
  const userTrackingId = ensureUserTrackingIdOnResponse(request, response);

  if (!requesterIsLikelyBot) {
    void logClick(link, request, clickTimestamp, userTrackingId).catch(
      (error: unknown) => {
        console.error("Click logging failed", {
          shortCode: requestedShortCode,
          error,
        });
      },
    );

    void enqueueAttributionTouchpoint({
      userTrackingId,
      userId: link.userId.toString(),
      sessionId: null,
      linkId: link._id.toString(),
      platform: link.platform ?? null,
      campaign: link.campaign ?? null,
      type: "click",
      timestampMs: clickTimestamp.getTime(),
    }).catch((enqueueError: unknown) => {
      console.error("Attribution click enqueue failed", {
        shortCode: requestedShortCode,
        error: enqueueError,
      });
    });
  }

  const trackedRedirectUrl = appendTrackingParam(
    link.originalUrl,
    link._id.toString(),
    clickTimestamp.getTime(),
    userTrackingId,
  );

  response.redirect(302, trackedRedirectUrl);
};
