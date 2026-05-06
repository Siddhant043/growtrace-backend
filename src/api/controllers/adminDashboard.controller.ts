import type { Request, Response } from "express";

import { getAdminDashboard } from "../../services/adminDashboard.service.js";
import type { GetAdminDashboardRequestQuery } from "../validators/adminDashboard.validator.js";

export const getAdminDashboardController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = request.query as unknown as GetAdminDashboardRequestQuery;

  const dashboardPayload = await getAdminDashboard({
    chartStartDate: query.chartStartDate,
    chartEndDate: query.chartEndDate,
    chartPage: query.chartPage ?? 1,
    chartLimit: query.chartLimit ?? 14,
    activityCursor: query.activityCursor,
    activityLimit: query.activityLimit ?? 10,
    alertsPage: query.alertsPage ?? 1,
    alertsLimit: query.alertsLimit ?? 10,
  });

  response.status(200).json(dashboardPayload);
};
