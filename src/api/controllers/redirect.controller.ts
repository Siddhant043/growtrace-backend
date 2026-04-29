import type { Request, Response } from "express";

import { LinkModel } from "../models/link.model";
import { logClick } from "../../services/tracking.service";
import { appendTrackingParam } from "../utils/appendTrackingParam";
import { isLikelyBot } from "../utils/isLikelyBot";

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

  if (!requesterIsLikelyBot) {
    void logClick(link, request).catch((error: unknown) => {
      console.error("Click logging failed", {
        shortCode: requestedShortCode,
        error,
      });
    });
  }

  const trackedRedirectUrl = appendTrackingParam(
    link.originalUrl,
    link._id.toString(),
  );

  response.redirect(302, trackedRedirectUrl);
};
