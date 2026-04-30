import {
  evaluateAllAlertCandidatesForUser,
  type DetectedAlertCandidate,
} from "./alertDetection.service";
import {
  getAlertsDispatchQueue,
  type AlertsDispatchJobPayload,
} from "../infrastructure/queue";
import {
  buildAlertDedupeKey,
} from "../utils/alertDedup.utils";
import { checkUserEligibleForAlerts } from "../utils/alertEligibility.utils";
import type { AlertsDetectionReason } from "../infrastructure/queue";

export interface ProduceAlertsForUserSummary {
  userId: string;
  reason: AlertsDetectionReason;
  evaluatedCandidateCount: number;
  enqueuedDispatchJobCount: number;
  skipReason?: "user_not_found" | "user_in_grace_period" | "insufficient_history";
}

const DETECTION_JOB_NAME = "dispatch-alert";

const buildDispatchJobsFromCandidates = (
  userId: string,
  candidates: readonly DetectedAlertCandidate[],
): Array<{
  name: string;
  data: AlertsDispatchJobPayload;
  opts: { jobId: string };
}> => {
  return candidates.map((candidate) => {
    const dedupeKey = buildAlertDedupeKey({
      userId,
      type: candidate.type,
      metadataKey: candidate.metadataKey,
      occurredAtMs: candidate.occurredAtMs,
    });

    const dispatchJobPayload: AlertsDispatchJobPayload = {
      userId,
      type: candidate.type,
      headline: candidate.headline,
      message: candidate.message,
      metadata: candidate.metadata,
      dedupeKey,
      deepLinkPath: candidate.deepLinkPath,
      occurredAtMs: candidate.occurredAtMs,
      source: "rule",
    };

    return {
      name: DETECTION_JOB_NAME,
      data: dispatchJobPayload,
      opts: { jobId: dedupeKey },
    };
  });
};

export const produceAlertsForUser = async (
  userId: string,
  reason: AlertsDetectionReason,
): Promise<ProduceAlertsForUserSummary> => {
  const eligibility = await checkUserEligibleForAlerts(userId);
  if (!eligibility.isEligible) {
    return {
      userId,
      reason,
      evaluatedCandidateCount: 0,
      enqueuedDispatchJobCount: 0,
      skipReason: eligibility.reason,
    };
  }

  const detectedCandidates = await evaluateAllAlertCandidatesForUser(userId);

  if (detectedCandidates.length === 0) {
    return {
      userId,
      reason,
      evaluatedCandidateCount: 0,
      enqueuedDispatchJobCount: 0,
    };
  }

  const dispatchJobs = buildDispatchJobsFromCandidates(
    userId,
    detectedCandidates,
  );

  const alertsDispatchQueue = getAlertsDispatchQueue();
  const enqueuedJobs = await alertsDispatchQueue.addBulk(dispatchJobs);

  return {
    userId,
    reason,
    evaluatedCandidateCount: detectedCandidates.length,
    enqueuedDispatchJobCount: enqueuedJobs.length,
  };
};
