import type { Request, Response } from "express";

import {
  getAdminAlertDetails,
  listAdminAlerts,
  listAdminAlertSettings,
  updateAdminAlertSettings,
} from "../../services/adminAlerts.service.js";
import type {
  GetAdminAlertDetailsRequestParams,
  ListAdminAlertsRequestQuery,
  UpdateAdminAlertSettingsRequestBody,
  UpdateAdminAlertSettingsRequestParams,
} from "../validators/adminAlerts.validator.js";

export const listAdminAlertsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = request.query as unknown as ListAdminAlertsRequestQuery;
  const alertsResponse = await listAdminAlerts({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    type: query.type,
    userId: query.userId,
    startDate: query.startDate,
    endDate: query.endDate,
  });

  response.status(200).json(alertsResponse);
};

export const getAdminAlertDetailsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as GetAdminAlertDetailsRequestParams;
  const alertDetails = await getAdminAlertDetails(params.alertId);
  response.status(200).json(alertDetails);
};

export const listAdminAlertSettingsController = async (
  _request: Request,
  response: Response,
): Promise<void> => {
  const settings = await listAdminAlertSettings();
  response.status(200).json(settings);
};

export const updateAdminAlertSettingsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as UpdateAdminAlertSettingsRequestParams;
  const body = request.body as UpdateAdminAlertSettingsRequestBody;

  const updatedSettings = await updateAdminAlertSettings(params.type, {
    enabled: body.enabled,
    thresholds: body.thresholds,
    cooldownHours: body.cooldownHours,
  });

  response.status(200).json({
    success: true,
    data: updatedSettings,
  });
};

