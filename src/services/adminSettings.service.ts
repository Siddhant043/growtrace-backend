import { EmailTemplateModel } from "../api/models/emailTemplate.model.js";
import { FeatureFlagModel } from "../api/models/featureFlag.model.js";
import {
  NotificationSettingModel,
  type NotificationSettingChannel,
} from "../api/models/notificationSetting.model.js";
import { invalidateRuntimeConfigCache } from "./adminRuntimeConfig.service.js";
import {
  extractTemplateVariables,
  renderEmailTemplateBody,
  sanitizeHtmlTemplate,
} from "../utils/emailTemplate.utils.js";

type ServiceApiError = Error & { statusCode: number };

const createServiceApiError = (
  message: string,
  statusCode: number,
): ServiceApiError => {
  const apiError = new Error(message) as ServiceApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

export const listFeatureFlags = async () => {
  const featureFlags = await FeatureFlagModel.find({}).sort({ key: 1 }).lean();
  return featureFlags.map((featureFlag) => ({
    _id: featureFlag._id.toString(),
    key: featureFlag.key,
    enabled: featureFlag.enabled,
    description: featureFlag.description,
    createdAt: featureFlag.createdAt,
    updatedAt: featureFlag.updatedAt,
  }));
};

export const updateFeatureFlag = async (
  key: string,
  body: { enabled: boolean; description?: string },
) => {
  await FeatureFlagModel.updateOne(
    { key },
    {
      $set: {
        enabled: body.enabled,
        ...(body.description !== undefined ? { description: body.description } : {}),
      },
      $setOnInsert: { key },
    },
    { upsert: true },
  );

  const updatedFeatureFlag = await FeatureFlagModel.findOne({ key }).lean();
  if (!updatedFeatureFlag) {
    throw createServiceApiError("Failed to update feature flag", 500);
  }

  await invalidateRuntimeConfigCache();

  return {
    _id: updatedFeatureFlag._id.toString(),
    key: updatedFeatureFlag.key,
    enabled: updatedFeatureFlag.enabled,
    description: updatedFeatureFlag.description,
    updatedAt: updatedFeatureFlag.updatedAt,
  };
};

export const listEmailTemplates = async () => {
  const templates = await EmailTemplateModel.find({})
    .sort({ key: 1 })
    .lean();
  return templates.map((template) => ({
    _id: template._id.toString(),
    key: template.key,
    subject: template.subject,
    variables: template.variables,
    updatedAt: template.updatedAt,
  }));
};

export const getEmailTemplateDetails = async (key: string) => {
  const template = await EmailTemplateModel.findOne({ key }).lean();
  if (!template) {
    throw createServiceApiError("Email template not found", 404);
  }

  return {
    _id: template._id.toString(),
    key: template.key,
    subject: template.subject,
    body: template.body,
    variables: template.variables,
    updatedAt: template.updatedAt,
    createdAt: template.createdAt,
  };
};

export const updateEmailTemplate = async (
  key: string,
  body: { subject: string; body: string },
) => {
  const sanitizedHtmlBody = sanitizeHtmlTemplate(body.body);
  const extractedVariables = extractTemplateVariables(sanitizedHtmlBody);

  await EmailTemplateModel.updateOne(
    { key },
    {
      $set: {
        subject: body.subject,
        body: sanitizedHtmlBody,
        variables: extractedVariables,
      },
      $setOnInsert: { key },
    },
    { upsert: true },
  );

  const updatedTemplate = await EmailTemplateModel.findOne({ key }).lean();
  if (!updatedTemplate) {
    throw createServiceApiError("Failed to update email template", 500);
  }

  return {
    _id: updatedTemplate._id.toString(),
    key: updatedTemplate.key,
    subject: updatedTemplate.subject,
    body: updatedTemplate.body,
    variables: updatedTemplate.variables,
    updatedAt: updatedTemplate.updatedAt,
  };
};

export const previewEmailTemplate = async (
  key: string,
  templateVariables: Record<string, string>,
) => {
  const template = await EmailTemplateModel.findOne({ key }).lean();
  if (!template) {
    throw createServiceApiError("Email template not found", 404);
  }

  const renderResult = renderEmailTemplateBody(template.body, templateVariables);
  return {
    subject: template.subject,
    renderedBody: renderResult.renderedBody,
    unresolvedVariables: renderResult.unresolvedVariables,
  };
};

export const listNotificationSettings = async () => {
  const settings = await NotificationSettingModel.find({})
    .sort({ type: 1 })
    .lean();

  return settings.map((setting) => ({
    _id: setting._id.toString(),
    type: setting.type,
    enabled: setting.enabled,
    channels: setting.channels,
    updatedAt: setting.updatedAt,
  }));
};

export const updateNotificationSettings = async (
  type: string,
  body: { enabled: boolean; channels: NotificationSettingChannel[] },
) => {
  await NotificationSettingModel.updateOne(
    { type },
    {
      $set: {
        enabled: body.enabled,
        channels: body.channels,
      },
      $setOnInsert: {
        type,
      },
    },
    { upsert: true },
  );

  const updatedSetting = await NotificationSettingModel.findOne({ type }).lean();
  if (!updatedSetting) {
    throw createServiceApiError("Failed to update notification settings", 500);
  }

  await invalidateRuntimeConfigCache();

  return {
    _id: updatedSetting._id.toString(),
    type: updatedSetting.type,
    enabled: updatedSetting.enabled,
    channels: updatedSetting.channels,
    updatedAt: updatedSetting.updatedAt,
  };
};
