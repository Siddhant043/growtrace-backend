import type { Request } from "express";

import { ClickEventModel } from "../api/models/clickEvent.model";
import type { LinkDocument } from "../api/models/link.model";
import { getCountryFromIP } from "../api/utils/getCountryFromIP";
import { parseUserAgent } from "../api/utils/parseUserAgent";

type TrackingLinkPayload = Pick<
  LinkDocument,
  "_id" | "userId" | "platform" | "postId" | "campaign"
>;

const resolveClientIpAddress = (request: Request): string | undefined => {
  const forwardedForHeader = request.headers["x-forwarded-for"];

  if (typeof forwardedForHeader === "string" && forwardedForHeader.length > 0) {
    return forwardedForHeader.split(",")[0]?.trim();
  }

  return request.ip || undefined;
};

export const logClick = async (
  link: TrackingLinkPayload,
  request: Request,
): Promise<void> => {
  const ipAddress = resolveClientIpAddress(request);
  const userAgentHeader = request.get("user-agent");
  const referrerHeader = request.get("referer") ?? request.get("referrer") ?? "";
  const { deviceType, browser } = parseUserAgent(userAgentHeader);
  const country = await getCountryFromIP(ipAddress);

  await ClickEventModel.create({
    linkId: link._id,
    userId: link.userId,
    platform: link.platform,
    postId: link.postId,
    campaign: link.campaign ?? null,
    timestamp: new Date(),
    country,
    deviceType,
    browser,
    referrer: referrerHeader,
  });
};
