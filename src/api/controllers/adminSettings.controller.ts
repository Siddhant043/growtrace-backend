import type { Request, Response } from "express";

import {
  getEmailTemplateDetails,
  listEmailTemplates,
  listFeatureFlags,
  listNotificationSettings,
  previewEmailTemplate,
  updateEmailTemplate,
  updateFeatureFlag,
  updateNotificationSettings,
} from "../../services/adminSettings.service.js";
import type {
  GetEmailTemplateDetailsRequestParams,
  UpdateEmailTemplateRequestBody,
  UpdateEmailTemplateRequestParams,
  UpdateFeatureFlagRequestBody,
  UpdateFeatureFlagRequestParams,
  UpdateNotificationSettingsRequestBody,
  UpdateNotificationSettingsRequestParams,
} from "../validators/adminSettings.validator.js";

export const listFeatureFlagsController = async (
  _request: Request,
  response: Response,
): Promise<void> => {
  const featureFlags = await listFeatureFlags();
  response.status(200).json(featureFlags);
};

export const updateFeatureFlagController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as UpdateFeatureFlagRequestParams;
  const body = request.body as UpdateFeatureFlagRequestBody;
  const updatedFeatureFlag = await updateFeatureFlag(params.key, body);
  response.status(200).json({ success: true, data: updatedFeatureFlag });
};

export const listEmailTemplatesController = async (
  _request: Request,
  response: Response,
): Promise<void> => {
  const emailTemplates = await listEmailTemplates();
  response.status(200).json(emailTemplates);
};

export const getEmailTemplateDetailsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as GetEmailTemplateDetailsRequestParams;
  const emailTemplate = await getEmailTemplateDetails(params.key);
  response.status(200).json(emailTemplate);
};

export const updateEmailTemplateController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as UpdateEmailTemplateRequestParams;
  const body = request.body as UpdateEmailTemplateRequestBody;
  const updatedTemplate = await updateEmailTemplate(params.key, body);
  response.status(200).json({ success: true, data: updatedTemplate });
};

export const previewEmailTemplateController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as GetEmailTemplateDetailsRequestParams;
  const body = request.body as { variables?: Record<string, string> };
  const previewResult = await previewEmailTemplate(params.key, body.variables ?? {});
  response.status(200).json(previewResult);
};

export const listNotificationSettingsController = async (
  _request: Request,
  response: Response,
): Promise<void> => {
  const notificationSettings = await listNotificationSettings();
  response.status(200).json(notificationSettings);
};

export const updateNotificationSettingsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as UpdateNotificationSettingsRequestParams;
  const body = request.body as UpdateNotificationSettingsRequestBody;
  const updatedSettings = await updateNotificationSettings(params.type, body);
  response.status(200).json({ success: true, data: updatedSettings });
};
