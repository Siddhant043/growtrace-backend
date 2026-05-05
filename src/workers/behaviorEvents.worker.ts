import { Types } from "mongoose";
import type { Job, Worker } from "bullmq";

import {
  createBehaviorEventsWorker,
  BEHAVIOR_EVENTS_QUEUE_NAME,
  type BehaviorEventJobPayload,
} from "../infrastructure/queue.js";
import {
  BehaviorEventModel,
  type BehaviorEventType,
} from "../api/models/behaviorEvent.model.js";
import { SessionModel } from "../api/models/session.model.js";
import { parseUserAgent } from "../api/utils/parseUserAgent.js";
import { getLinkMetadataSummary } from "../api/utils/linkMetadataCache.js";
import { BOUNCE_DURATION_THRESHOLD_SECONDS } from "../api/constants/engagement.js";
import { attachWorkerMonitoring } from "../services/systemMonitoring.workerHealth.service.js";

const toObjectIdOrNull = (
  candidateId: string | null,
): Types.ObjectId | null => {
  if (!candidateId || !Types.ObjectId.isValid(candidateId)) {
    return null;
  }

  return new Types.ObjectId(candidateId);
};

const persistBehaviorEvent = async (
  jobPayload: BehaviorEventJobPayload,
  eventTimestamp: Date,
): Promise<void> => {
  await BehaviorEventModel.create({
    sessionId: jobPayload.sessionId,
    userId: new Types.ObjectId(jobPayload.userId),
    userTrackingId: jobPayload.userTrackingId ?? "unknown",
    linkId: toObjectIdOrNull(jobPayload.linkId),
    eventType: jobPayload.eventType as BehaviorEventType,
    platform: "unknown",
    timestamp: eventTimestamp,
    page: {
      url: jobPayload.page.url,
      referrer: jobPayload.page.referrer,
    },
    device: {
      userAgent: jobPayload.device.userAgent,
      screen: jobPayload.device.screen,
    },
    metrics: {
      scrollDepth: jobPayload.metrics.scrollDepth ?? null,
      duration: jobPayload.metrics.duration ?? null,
    },
    metadata: {
      eventType: jobPayload.eventType,
      isReturning: jobPayload.isReturning,
      receivedAt: jobPayload.receivedAt,
    },
    country: jobPayload.country,
  });
};

const resolveUserTrackingIdSetField = (
  jobPayload: BehaviorEventJobPayload,
): { userTrackingId: string } | Record<string, never> => {
  if (
    typeof jobPayload.userTrackingId === "string" &&
    jobPayload.userTrackingId.trim().length > 0
  ) {
    return { userTrackingId: jobPayload.userTrackingId.trim() };
  }

  return {};
};

const upsertSessionForPageView = async (
  jobPayload: BehaviorEventJobPayload,
  eventTimestamp: Date,
): Promise<void> => {
  const { deviceType, browser } = parseUserAgent(jobPayload.userAgentHeader);
  const linkObjectIdValue = toObjectIdOrNull(jobPayload.linkId);
  const linkMetadataSummary = await getLinkMetadataSummary(jobPayload.linkId);

  await SessionModel.updateOne(
    { sessionId: jobPayload.sessionId },
    {
      $set: {
        lastActivityAt: eventTimestamp,
        ...(linkObjectIdValue ? { linkId: linkObjectIdValue } : {}),
        ...(linkMetadataSummary.platform
          ? { platform: linkMetadataSummary.platform }
          : {}),
        ...(linkMetadataSummary.campaign
          ? { campaign: linkMetadataSummary.campaign }
          : {}),
        ...resolveUserTrackingIdSetField(jobPayload),
      },
      $setOnInsert: {
        sessionId: jobPayload.sessionId,
        userId: new Types.ObjectId(jobPayload.userId),
        firstVisitAt: eventTimestamp,
        ...(typeof jobPayload.firstClickAtMs === "number"
          ? { firstClickAt: new Date(jobPayload.firstClickAtMs) }
          : {}),
        isReturning: jobPayload.isReturning,
        entryUrl: jobPayload.page.url,
        referrer: jobPayload.page.referrer,
        country: jobPayload.country,
        deviceType,
        browser,
        userAgent: jobPayload.userAgentHeader,
        duration: 0,
        maxScrollDepth: 0,
        isBounce: true,
      },
    },
    { upsert: true },
  );
};

const updateSessionForScroll = async (
  jobPayload: BehaviorEventJobPayload,
  eventTimestamp: Date,
): Promise<void> => {
  const measuredScrollDepth = jobPayload.metrics.scrollDepth ?? 0;

  await SessionModel.updateOne(
    { sessionId: jobPayload.sessionId },
    {
      $max: { maxScrollDepth: measuredScrollDepth },
      $set: {
        lastActivityAt: eventTimestamp,
        ...resolveUserTrackingIdSetField(jobPayload),
      },
    },
  );
};

const updateSessionForExit = async (
  jobPayload: BehaviorEventJobPayload,
  eventTimestamp: Date,
): Promise<void> => {
  const measuredDurationSeconds = jobPayload.metrics.duration ?? 0;
  const measuredScrollDepth = jobPayload.metrics.scrollDepth ?? 0;
  const computedIsBounce =
    measuredDurationSeconds < BOUNCE_DURATION_THRESHOLD_SECONDS;

  await SessionModel.updateOne(
    { sessionId: jobPayload.sessionId },
    {
      $max: {
        maxScrollDepth: measuredScrollDepth,
        duration: measuredDurationSeconds,
      },
      $set: {
        lastActivityAt: eventTimestamp,
        isBounce: computedIsBounce,
        ...resolveUserTrackingIdSetField(jobPayload),
      },
    },
  );
};

export const processBehaviorEventJob = async (
  job: Job<BehaviorEventJobPayload>,
): Promise<void> => {
  const jobPayload = job.data;
  const eventTimestamp = new Date(
    jobPayload.clientTimestamp || jobPayload.receivedAt,
  );

  await persistBehaviorEvent(jobPayload, eventTimestamp);

  switch (jobPayload.eventType) {
    case "page_view":
      await upsertSessionForPageView(jobPayload, eventTimestamp);
      break;
    case "scroll":
      await updateSessionForScroll(jobPayload, eventTimestamp);
      break;
    case "exit":
      await updateSessionForExit(jobPayload, eventTimestamp);
      break;
    default:
      break;
  }
};

export const startBehaviorEventsWorker = (): Worker<BehaviorEventJobPayload> => {
  const worker = createBehaviorEventsWorker(processBehaviorEventJob);
  attachWorkerMonitoring(worker, BEHAVIOR_EVENTS_QUEUE_NAME);

  worker.on("failed", (failedJob, failureError) => {
    console.error("[behaviorEvents.worker] Job failed", {
      jobId: failedJob?.id,
      attemptsMade: failedJob?.attemptsMade,
      error: failureError,
    });
  });

  worker.on("error", (workerError) => {
    console.error("[behaviorEvents.worker] Worker error", workerError);
  });

  return worker;
};
