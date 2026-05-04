import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/authenticate.js";
import type { LinkPlatform } from "../models/link.model.js";
import {
  getSessionDetailForUser,
  listSessionsForUser,
} from "../../services/session.service.js";

const getAuthenticatedRequest = (request: Request): AuthenticatedRequest =>
  request as AuthenticatedRequest;

const parseOptionalString = (rawValue: unknown): string | undefined =>
  typeof rawValue === "string" && rawValue.length > 0 ? rawValue : undefined;

const parseOptionalIntegerFromQuery = (
  rawValue: unknown,
): number | undefined => {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }
  if (typeof rawValue === "string" && rawValue.length > 0) {
    const parsedValue = Number.parseInt(rawValue, 10);
    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }
  return undefined;
};

export const listSessions = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);

  const sessionsListResponse = await listSessionsForUser(
    authenticatedRequest.authenticatedUser.id,
    {
      linkId: parseOptionalString(request.query.linkId),
      platform: parseOptionalString(request.query.platform) as
        | LinkPlatform
        | undefined,
      campaign: parseOptionalString(request.query.campaign),
      fromDate: parseOptionalString(request.query.from),
      toDate: parseOptionalString(request.query.to),
      page: parseOptionalIntegerFromQuery(request.query.page),
      pageSize: parseOptionalIntegerFromQuery(request.query.pageSize),
    },
  );

  response.status(200).json({
    success: true,
    data: sessionsListResponse,
  });
};

export const getSessionDetail = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const sessionIdParam = request.params.sessionId as string;

  const sessionDetail = await getSessionDetailForUser(
    authenticatedRequest.authenticatedUser.id,
    sessionIdParam,
  );

  if (!sessionDetail) {
    response.status(404).json({
      success: false,
      message: "Session not found",
    });
    return;
  }

  response.status(200).json({
    success: true,
    data: sessionDetail,
  });
};
