const TRACKING_LINK_QUERY_PARAM_NAME = "gt_link_id";
const TRACKING_CLICK_TIMESTAMP_QUERY_PARAM_NAME = "gt_click_ts";
const TRACKING_USER_ID_QUERY_PARAM_NAME = "gt_uid";

const isAbsoluteHttpUrl = (candidateUrl: string): boolean =>
  candidateUrl.startsWith("http://") || candidateUrl.startsWith("https://");

export const appendTrackingParam = (
  destinationUrl: string,
  linkIdValue: string,
  clickTimestampMs?: number,
  userTrackingIdValue?: string,
): string => {
  const trimmedDestinationUrl = destinationUrl.trim();
  const trimmedLinkIdValue = linkIdValue.trim();

  if (
    trimmedDestinationUrl.length === 0 ||
    trimmedLinkIdValue.length === 0 ||
    !isAbsoluteHttpUrl(trimmedDestinationUrl)
  ) {
    return destinationUrl;
  }

  try {
    const parsedDestinationUrl = new URL(trimmedDestinationUrl);
    parsedDestinationUrl.searchParams.set(
      TRACKING_LINK_QUERY_PARAM_NAME,
      trimmedLinkIdValue,
    );

    if (
      typeof clickTimestampMs === "number" &&
      Number.isFinite(clickTimestampMs) &&
      clickTimestampMs >= 0
    ) {
      parsedDestinationUrl.searchParams.set(
        TRACKING_CLICK_TIMESTAMP_QUERY_PARAM_NAME,
        String(Math.floor(clickTimestampMs)),
      );
    }

    if (
      typeof userTrackingIdValue === "string" &&
      userTrackingIdValue.trim().length > 0
    ) {
      parsedDestinationUrl.searchParams.set(
        TRACKING_USER_ID_QUERY_PARAM_NAME,
        userTrackingIdValue.trim(),
      );
    }

    return parsedDestinationUrl.toString();
  } catch {
    return destinationUrl;
  }
};
