import type { Request, Response } from "express";
import { Types } from "mongoose";

import { connectToRedis } from "../../infrastructure/redis";
import {
  enqueueBehaviorEvent,
  type BehaviorEventJobPayload,
} from "../../infrastructure/queue";
import { enqueueAttributionTouchpoint } from "../../services/attributionProducer.service";
import {
  mapBehaviorEventToAttributionTouchpointType,
  type BehaviorEventForAttribution,
} from "../../utils/attribution.eventMapper";
import { UserModel } from "../models/user.model";
import { LinkModel } from "../models/link.model";
import { resolveClientIpAddress } from "../utils/resolveClientIpAddress";
import { getCountryFromIP } from "../utils/getCountryFromIP";
import { isLikelyBot } from "../utils/isLikelyBot";
import { readUserTrackingIdFromRequest } from "../utils/userTrackingCookie";
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

  const cookieTrackingId = readUserTrackingIdFromRequest(request);
  const resolvedUserTrackingId =
    eventBody.userTrackingId ?? cookieTrackingId ?? null;

  const jobPayload: BehaviorEventJobPayload = {
    apiKey: eventBody.apiKey,
    userId: resolvedUserId,
    linkId: linkIdValueIfValid,
    sessionId: eventBody.sessionId,
    userTrackingId: resolvedUserTrackingId,
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

  if (resolvedUserTrackingId) {
    void fanOutAttributionTouchpointForBehaviorEvent({
      eventBody,
      resolvedUserId,
      resolvedUserTrackingId,
      linkIdValueIfValid,
      userAgentHeader,
    }).catch((attributionError: unknown) => {
      console.error("Failed to fan out attribution touchpoint", attributionError);
    });
  }

  respondAcknowledged(response);
};

interface FanOutAttributionParameters {
  eventBody: TrackEventRequestBody;
  resolvedUserId: string;
  resolvedUserTrackingId: string;
  linkIdValueIfValid: string | null;
  userAgentHeader: string;
}

const fanOutAttributionTouchpointForBehaviorEvent = async ({
  eventBody,
  resolvedUserId,
  resolvedUserTrackingId,
  linkIdValueIfValid,
  userAgentHeader,
}: FanOutAttributionParameters): Promise<void> => {
  const behaviorEventForMapper: BehaviorEventForAttribution = {
    eventType: eventBody.eventType,
    durationSeconds: eventBody.metrics.duration ?? null,
    scrollDepthPercent: eventBody.metrics.scrollDepth ?? null,
  };

  const mappedTouchpointType = mapBehaviorEventToAttributionTouchpointType(
    behaviorEventForMapper,
  );

  if (!mappedTouchpointType) {
    return;
  }

  const linkPlatformAndCampaign = await resolveLinkContext(linkIdValueIfValid);

  await enqueueAttributionTouchpoint({
    userTrackingId: resolvedUserTrackingId,
    userId: resolvedUserId,
    sessionId: eventBody.sessionId,
    linkId: linkIdValueIfValid,
    platform: linkPlatformAndCampaign.platform,
    campaign: linkPlatformAndCampaign.campaign,
    type: mappedTouchpointType,
    timestampMs: eventBody.timestamp,
    userAgent: userAgentHeader,
  });
};

const resolveLinkContext = async (
  linkId: string | null,
): Promise<{ platform: string | null; campaign: string | null }> => {
  if (!linkId || !Types.ObjectId.isValid(linkId)) {
    return { platform: null, campaign: null };
  }

  const linkDocument = await LinkModel.findById(linkId)
    .select("platform campaign")
    .lean();

  if (!linkDocument) {
    return { platform: null, campaign: null };
  }

  return {
    platform: linkDocument.platform ?? null,
    campaign: linkDocument.campaign ?? null,
  };
};
