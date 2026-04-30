import type { AttributionTouchpointType } from "../infrastructure/queue";

export interface BehaviorEventForAttribution {
  eventType: string;
  durationSeconds?: number | null;
  scrollDepthPercent?: number | null;
}

const ENGAGED_DURATION_THRESHOLD_SECONDS = 30;
const ENGAGED_SCROLL_THRESHOLD_PERCENT = 50;

export const mapBehaviorEventToAttributionTouchpointType = (
  behaviorEvent: BehaviorEventForAttribution,
): AttributionTouchpointType | null => {
  const normalizedEventType = behaviorEvent.eventType.toLowerCase().trim();

  if (normalizedEventType === "page_view") {
    return "visit";
  }

  if (normalizedEventType === "conversion") {
    return "conversion";
  }

  const exceedsDurationThreshold =
    typeof behaviorEvent.durationSeconds === "number" &&
    behaviorEvent.durationSeconds >= ENGAGED_DURATION_THRESHOLD_SECONDS;

  const exceedsScrollThreshold =
    typeof behaviorEvent.scrollDepthPercent === "number" &&
    behaviorEvent.scrollDepthPercent >= ENGAGED_SCROLL_THRESHOLD_PERCENT;

  if (
    (normalizedEventType === "scroll" || normalizedEventType === "exit") &&
    (exceedsDurationThreshold || exceedsScrollThreshold)
  ) {
    return "engaged";
  }

  return null;
};
