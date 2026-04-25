import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/authenticate";
import { getDashboardPayload } from "../../services/dashboard.service";

const getAuthenticatedRequest = (request: Request): AuthenticatedRequest =>
  request as AuthenticatedRequest;

export const getDashboard = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = getAuthenticatedRequest(request);
  const dashboardPayload = await getDashboardPayload(
    authenticatedRequest.authenticatedUser.id,
  );

  response.status(200).json({
    success: true,
    data: dashboardPayload,
  });
};
