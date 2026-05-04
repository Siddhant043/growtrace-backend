import type { Request } from "express";

export const resolveClientIpAddress = (
  request: Request,
): string | null => {
  const forwardedForHeader = request.headers["x-forwarded-for"];

  if (typeof forwardedForHeader === "string" && forwardedForHeader.length > 0) {
    const firstForwardedIp = forwardedForHeader.split(",")[0]?.trim();
    if (firstForwardedIp && firstForwardedIp.length > 0) {
      return firstForwardedIp;
    }
  }

  return request.ip ?? null;
};
