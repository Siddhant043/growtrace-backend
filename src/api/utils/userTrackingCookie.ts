import type { CookieOptions, Request, Response } from "express";

import { env } from "../../config/env";
import { generateUuidV4 } from "./generateUuidV4";

const SECONDS_PER_DAY = 86_400;

const isAcceptableTrackingId = (
  candidateValue: string | undefined,
): candidateValue is string => {
  if (typeof candidateValue !== "string") {
    return false;
  }
  const trimmedValue = candidateValue.trim();
  return trimmedValue.length >= 8 && trimmedValue.length <= 64;
};

export const readUserTrackingIdFromRequest = (
  request: Request,
): string | null => {
  const cookieJar = (request as Request & { cookies?: Record<string, string> })
    .cookies;
  const cookieValue = cookieJar
    ? cookieJar[env.ATTRIBUTION_USER_COOKIE_NAME]
    : undefined;

  if (isAcceptableTrackingId(cookieValue)) {
    return cookieValue.trim();
  }

  return null;
};

export const ensureUserTrackingIdOnResponse = (
  request: Request,
  response: Response,
): string => {
  const existingTrackingId = readUserTrackingIdFromRequest(request);

  if (existingTrackingId) {
    return existingTrackingId;
  }

  const newTrackingId = generateUuidV4();

  const cookieOptions: CookieOptions = {
    httpOnly: false,
    sameSite: "lax",
    secure: env.ENV === "production",
    path: "/",
    maxAge: env.ATTRIBUTION_USER_COOKIE_MAX_AGE_DAYS * SECONDS_PER_DAY * 1000,
  };

  response.cookie(
    env.ATTRIBUTION_USER_COOKIE_NAME,
    newTrackingId,
    cookieOptions,
  );

  return newTrackingId;
};
