import {
  ATTRIBUTION_TOUCHPOINT_JOB_NAME,
  getAttributionQueue,
  type AttributionTouchpointJobPayload,
} from "../infrastructure/queue.js";
import { computeTouchpointDedupeKey } from "../utils/attribution.dedupe.js";

export const enqueueAttributionTouchpoint = async (
  jobPayload: AttributionTouchpointJobPayload,
): Promise<void> => {
  const dedupeKey = computeTouchpointDedupeKey(jobPayload);

  await getAttributionQueue().add(
    ATTRIBUTION_TOUCHPOINT_JOB_NAME,
    jobPayload,
    {
      jobId: dedupeKey,
    },
  );
};
