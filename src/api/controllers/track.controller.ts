import type { Request, Response } from "express";
import { Types } from "mongoose";

import { connectToRedis } from "../../infrastructure/redis";
import {
  enqueueBehaviorEvent,
  type BehaviorEventJobPayload,
} from "../../infrastructure/queue";
import { UserModel } from "../models/user.model";
import { resolveClientIpAddress } from "../utils/resolveClientIpAddress";
import { getCountryFromIP } from "../utils/getCountryFromIP";
import { isLikelyBot } from "../utils/isLikelyBot";
import type { TrackEventRequestBody } from "../validators/track.validator";

const API_KEY_CACHE_PREFIX = "tracking:apiKey:";
const API_KEY_CACHE_TTL_SECONDS = 5 * 60;
const API_KEY_INVALID_MARKER = "invalid";

const respondAcknowledged = (response: Response): void => {
  response.status(200).json({ success: true });
};

const resolveUserIdForApiKey = async (
  rawApiKey: string,
): Promise<string | null> => {
  const trimmedApiKey = rawApiKey.trim();
  if (!Types.ObjectId.isValid(trimmedApiKey)) {
    return null;
  }

  const redisClient = await connectToRedis();
  const cacheKey = `${API_KEY_CACHE_PREFIX}${trimmedApiKey}`;
  const cachedValue = await redisClient.get(cacheKey);

  if (cachedValue === API_KEY_INVALID_MARKER) {
    return null;
  }

  if (typeof cachedValue === "string" && cachedValue.length > 0) {
    return cachedValue;
  }

  const userDocument = await UserModel.findById(trimmedApiKey)
    .select("_id isDeleted")
    .lean();

  if (!userDocument || userDocument.isDeleted) {
    await redisClient.set(
      cacheKey,
      API_KEY_INVALID_MARKER,
      "EX",
      API_KEY_CACHE_TTL_SECONDS,
    );
    return null;
  }

  const resolvedUserId = userDocument._id.toString();
  await redisClient.set(
    cacheKey,
    resolvedUserId,
    "EX",
    API_KEY_CACHE_TTL_SECONDS,
  );

  return resolvedUserId;
};

export const ingestTrackingEvent = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const eventBody = request.body as TrackEventRequestBody;
  const userAgentHeader =
    eventBody.device.userAgent || request.get("user-agent") || "";

  if (isLikelyBot(userAgentHeader)) {
    respondAcknowledged(response);
    return;
  }

  const resolvedUserId = await resolveUserIdForApiKey(eventBody.apiKey);
  if (!resolvedUserId) {
    respondAcknowledged(response);
    return;
  }

  const linkIdValueIfValid =
    eventBody.linkId && Types.ObjectId.isValid(eventBody.linkId)
      ? eventBody.linkId
      : null;

  const ipAddress = resolveClientIpAddress(request);
  const country = await getCountryFromIP(ipAddress ?? undefined);

  const jobPayload: BehaviorEventJobPayload = {
    apiKey: eventBody.apiKey,
    userId: resolvedUserId,
    linkId: linkIdValueIfValid,
    sessionId: eventBody.sessionId,
    eventType: eventBody.eventType,
    clientTimestamp: eventBody.timestamp,
    page: {
      url: eventBody.page.url,
      referrer: eventBody.page.referrer,
    },
    device: {
      userAgent: eventBody.device.userAgent,
      screen: eventBody.device.screen,
    },
    metrics: {
      scrollDepth: eventBody.metrics.scrollDepth ?? null,
      duration: eventBody.metrics.duration ?? null,
    },
    isReturning: eventBody.isReturning,
    ipAddress,
    country,
    userAgentHeader,
    receivedAt: Date.now(),
    ...(typeof eventBody.firstClickAt === "number"
      ? { firstClickAtMs: eventBody.firstClickAt }
      : {}),
  };

  enqueueBehaviorEvent(jobPayload).catch((enqueueError: unknown) => {
    console.error("Failed to enqueue behavior event", enqueueError);
  });

  respondAcknowledged(response);
};
