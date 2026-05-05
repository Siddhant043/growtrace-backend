import type { NextFunction, Request, Response } from "express";

import type { AuthenticatedRequest } from "./authenticate.js";

type ApiError = Error & { statusCode: number };

const createApiError = (message: string, statusCode: number): ApiError => {
  const apiError = new Error(message) as ApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

export const requireSuperadmin = (
  request: Request,
  _response: Response,
  next: NextFunction,
): void => {
  const authenticatedRequest = request as Partial<AuthenticatedRequest>;
  const userType = authenticatedRequest.authenticatedUser?.userType;

  if (userType !== "superadmin") {
    next(createApiError("Superadmin access is required", 403));
    return;
  }

  next();
};

