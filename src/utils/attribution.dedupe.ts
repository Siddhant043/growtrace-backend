import { createHash } from "node:crypto";

import type { AttributionTouchpointJobPayload } from "../infrastructure/queue";

const ONE_MINUTE_MS = 60_000;

export const computeTouchpointDedupeKey = (
  touchpointPayload: AttributionTouchpointJobPayload,
): string => {
  const oneMinuteBucket = Math.floor(
    touchpointPayload.timestampMs / ONE_MINUTE_MS,
  );

  const dedupeKeyComponents = [
    touchpointPayload.userTrackingId,
    touchpointPayload.userId,
    touchpointPayload.linkId ?? "",
    touchpointPayload.sessionId ?? "",
    touchpointPayload.type,
    String(oneMinuteBucket),
  ];

  return createHash("sha256")
    .update(dedupeKeyComponents.join("|"))
    .digest("hex");
};
