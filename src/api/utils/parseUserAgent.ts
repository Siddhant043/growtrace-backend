import type { DeviceType } from "../models/clickEvent.model";

export type ParsedUserAgent = {
  deviceType: DeviceType;
  browser: string;
};

const detectDeviceType = (userAgent: string): DeviceType => {
  const normalizedUserAgent = userAgent.toLowerCase();

  if (/ipad|tablet|playbook|silk/.test(normalizedUserAgent)) {
    return "tablet";
  }

  if (/mobile|android|iphone|ipod|windows phone/.test(normalizedUserAgent)) {
    return "mobile";
  }

  return "desktop";
};

const detectBrowser = (userAgent: string): string => {
  const normalizedUserAgent = userAgent.toLowerCase();

  if (normalizedUserAgent.includes("edg/")) {
    return "Edge";
  }

  if (normalizedUserAgent.includes("opr/") || normalizedUserAgent.includes("opera")) {
    return "Opera";
  }

  if (normalizedUserAgent.includes("chrome/") && !normalizedUserAgent.includes("edg/")) {
    return "Chrome";
  }

  if (normalizedUserAgent.includes("firefox/")) {
    return "Firefox";
  }

  if (normalizedUserAgent.includes("safari/") && !normalizedUserAgent.includes("chrome/")) {
    return "Safari";
  }

  if (
    normalizedUserAgent.includes("msie") ||
    normalizedUserAgent.includes("trident/")
  ) {
    return "Internet Explorer";
  }

  return "unknown";
};

export const parseUserAgent = (userAgentHeaderValue: string | undefined): ParsedUserAgent => {
  const normalizedUserAgent = userAgentHeaderValue?.trim() ?? "";

  if (normalizedUserAgent.length === 0) {
    return {
      deviceType: "desktop",
      browser: "unknown",
    };
  }

  return {
    deviceType: detectDeviceType(normalizedUserAgent),
    browser: detectBrowser(normalizedUserAgent),
  };
};
