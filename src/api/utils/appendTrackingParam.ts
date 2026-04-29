const TRACKING_QUERY_PARAM_NAME = "gt_link_id";

const isAbsoluteHttpUrl = (candidateUrl: string): boolean =>
  candidateUrl.startsWith("http://") || candidateUrl.startsWith("https://");

export const appendTrackingParam = (
  destinationUrl: string,
  linkIdValue: string,
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
      TRACKING_QUERY_PARAM_NAME,
      trimmedLinkIdValue,
    );
    return parsedDestinationUrl.toString();
  } catch {
    return destinationUrl;
  }
};
