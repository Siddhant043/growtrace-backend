import { Types } from "mongoose";

import { env } from "../config/env";
import {
  TouchpointModel,
  type TouchpointDocument,
  type TouchpointType,
} from "../api/models/touchpoint.model";
import { JourneyModel } from "../api/models/journey.model";
import type { AttributionTouchpointJobPayload } from "../infrastructure/queue";
import { isLikelyBot } from "../api/utils/isLikelyBot";
import { computeTouchpointDedupeKey } from "../utils/attribution.dedupe";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ProcessAttributionResult {
  status:
    | "ingested"
    | "deduplicated"
    | "skipped-bot"
    | "skipped-invalid-user"
    | "skipped-invalid-tracking-id";
  touchpointId?: string;
  journeyId?: string;
}

const isHexObjectId = (candidateValue: string): boolean =>
  /^[a-fA-F0-9]{24}$/.test(candidateValue);

const computeJourneyWindowMs = (): number =>
  env.ATTRIBUTION_JOURNEY_WINDOW_DAYS * MILLISECONDS_PER_DAY;

const buildEmbeddedTouchpointSummary = (
  touchpointDocument: TouchpointDocument,
): {
  touchpointId: Types.ObjectId;
  platform: string | null;
  type: TouchpointType;
  linkId: Types.ObjectId | null;
  sessionId: string | null;
  timestamp: Date;
} => ({
  touchpointId: touchpointDocument._id,
  platform: touchpointDocument.platform ?? null,
  type: touchpointDocument.type as TouchpointType,
  linkId: touchpointDocument.linkId ?? null,
  sessionId: touchpointDocument.sessionId ?? null,
  timestamp: touchpointDocument.timestamp,
});

export const processAttributionTouchpointJob = async (
  jobPayload: AttributionTouchpointJobPayload,
): Promise<ProcessAttributionResult> => {
  if (jobPayload.userAgent && isLikelyBot(jobPayload.userAgent)) {
    return { status: "skipped-bot" };
  }

  const trimmedTrackingId = jobPayload.userTrackingId.trim();
  if (trimmedTrackingId.length < 8 || trimmedTrackingId.length > 64) {
    return { status: "skipped-invalid-tracking-id" };
  }

  if (!isHexObjectId(jobPayload.userId)) {
    return { status: "skipped-invalid-user" };
  }

  const userObjectId = new Types.ObjectId(jobPayload.userId);
  const linkObjectId =
    jobPayload.linkId && isHexObjectId(jobPayload.linkId)
      ? new Types.ObjectId(jobPayload.linkId)
      : null;

  const dedupeKey = computeTouchpointDedupeKey(jobPayload);
  const touchpointTimestamp = new Date(jobPayload.timestampMs);

  let persistedTouchpoint: TouchpointDocument | null = null;
  try {
    persistedTouchpoint = await TouchpointModel.create({
      userTrackingId: trimmedTrackingId,
      userId: userObjectId,
      sessionId: jobPayload.sessionId,
      linkId: linkObjectId,
      platform: jobPayload.platform,
      campaign: jobPayload.campaign,
      type: jobPayload.type,
      timestamp: touchpointTimestamp,
      dedupeKey,
    });
  } catch (insertError: unknown) {
    const isDuplicateKeyError =
      typeof insertError === "object" &&
      insertError !== null &&
      "code" in insertError &&
      (insertError as { code?: number }).code === 11000;

    if (!isDuplicateKeyError) {
      throw insertError;
    }
  }

  if (!persistedTouchpoint) {
    return { status: "deduplicated" };
  }

  const journeyWindowMs = computeJourneyWindowMs();
  const journeyWindowStart = new Date(
    persistedTouchpoint.timestamp.getTime() - journeyWindowMs,
  );

  const existingOpenJourney = await JourneyModel.findOne({
    userTrackingId: trimmedTrackingId,
    userId: userObjectId,
    isClosed: false,
    "lastTouch.timestamp": { $gte: journeyWindowStart },
  }).sort({ "lastTouch.timestamp": -1 });

  if (existingOpenJourney) {
    await closeStaleJourneysForTrackingId(
      trimmedTrackingId,
      userObjectId,
      existingOpenJourney._id,
      persistedTouchpoint.timestamp,
      journeyWindowMs,
    );

    const embeddedSummary = buildEmbeddedTouchpointSummary(persistedTouchpoint);

    await TouchpointModel.updateOne(
      { _id: persistedTouchpoint._id },
      { $set: { journeyId: existingOpenJourney._id } },
    );

    const distinctPlatformSet = new Set<string>();
    for (const journeyTouchpoint of existingOpenJourney.touchpoints) {
      if (journeyTouchpoint.platform) {
        distinctPlatformSet.add(journeyTouchpoint.platform);
      }
    }
    if (embeddedSummary.platform) {
      distinctPlatformSet.add(embeddedSummary.platform);
    }

    const updateOperations: Record<string, unknown> = {
      $push: { touchpoints: embeddedSummary },
      $inc: { touchpointCount: 1 },
      $set: {
        lastTouch: {
          platform: embeddedSummary.platform,
          type: embeddedSummary.type,
          linkId: embeddedSummary.linkId,
          timestamp: embeddedSummary.timestamp,
        },
        distinctPlatformCount: distinctPlatformSet.size,
      },
    };

    await JourneyModel.updateOne(
      { _id: existingOpenJourney._id },
      updateOperations,
    );

    return {
      status: "ingested",
      touchpointId: persistedTouchpoint._id.toString(),
      journeyId: existingOpenJourney._id.toString(),
    };
  }

  const embeddedSummary = buildEmbeddedTouchpointSummary(persistedTouchpoint);

  const newJourneyDocument = await JourneyModel.create({
    userTrackingId: trimmedTrackingId,
    userId: userObjectId,
    touchpoints: [embeddedSummary],
    firstTouch: {
      platform: embeddedSummary.platform,
      type: embeddedSummary.type,
      linkId: embeddedSummary.linkId,
      timestamp: embeddedSummary.timestamp,
    },
    lastTouch: {
      platform: embeddedSummary.platform,
      type: embeddedSummary.type,
      linkId: embeddedSummary.linkId,
      timestamp: embeddedSummary.timestamp,
    },
    touchpointCount: 1,
    distinctPlatformCount: embeddedSummary.platform ? 1 : 0,
    isClosed: false,
  });

  await TouchpointModel.updateOne(
    { _id: persistedTouchpoint._id },
    { $set: { journeyId: newJourneyDocument._id } },
  );

  return {
    status: "ingested",
    touchpointId: persistedTouchpoint._id.toString(),
    journeyId: newJourneyDocument._id.toString(),
  };
};

const closeStaleJourneysForTrackingId = async (
  trimmedTrackingId: string,
  userObjectId: Types.ObjectId,
  currentlyOpenJourneyId: Types.ObjectId,
  currentTouchpointTimestamp: Date,
  journeyWindowMs: number,
): Promise<void> => {
  const cutoffTimestamp = new Date(
    currentTouchpointTimestamp.getTime() - journeyWindowMs,
  );

  await JourneyModel.updateMany(
    {
      userTrackingId: trimmedTrackingId,
      userId: userObjectId,
      _id: { $ne: currentlyOpenJourneyId },
      isClosed: false,
      "lastTouch.timestamp": { $lt: cutoffTimestamp },
    },
    {
      $set: { isClosed: true, closedReason: "stale-window" },
    },
  );
};
