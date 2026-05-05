import { z } from "zod";

import { NOTIFICATION_SETTING_CHANNELS } from "../models/notificationSetting.model.js";

const trimmedKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z][a-z0-9_]*$/, "must use snake_case");

const notificationTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z][a-z0-9_]*$/, "must use snake_case");

export const listFeatureFlagsRequestSchema = z.object({
  query: z.object({}).default({}),
});

export const updateFeatureFlagRequestSchema = z.object({
  params: z.object({
    key: trimmedKeySchema,
  }),
  body: z.object({
    enabled: z.boolean(),
    description: z.string().trim().max(300).optional(),
  }),
});

export const listEmailTemplatesRequestSchema = z.object({
  query: z.object({}).default({}),
});

export const getEmailTemplateDetailsRequestSchema = z.object({
  params: z.object({
    key: trimmedKeySchema,
  }),
});

export const updateEmailTemplateRequestSchema = z.object({
  params: z.object({
    key: trimmedKeySchema,
  }),
  body: z.object({
    subject: z.string().trim().min(1).max(300),
    body: z.string().trim().min(1).max(100_000),
  }),
});

export const previewEmailTemplateRequestSchema = z.object({
  params: z.object({
    key: trimmedKeySchema,
  }),
  body: z.object({
    variables: z.record(z.string(), z.string()).optional(),
  }),
});

export const listNotificationSettingsRequestSchema = z.object({
  query: z.object({}).default({}),
});

export const updateNotificationSettingsRequestSchema = z.object({
  params: z.object({
    type: notificationTypeSchema,
  }),
  body: z.object({
    enabled: z.boolean(),
    channels: z.array(z.enum(NOTIFICATION_SETTING_CHANNELS)).min(1),
  }),
});

export type UpdateFeatureFlagRequestParams = z.infer<
  typeof updateFeatureFlagRequestSchema
>["params"];
export type UpdateFeatureFlagRequestBody = z.infer<
  typeof updateFeatureFlagRequestSchema
>["body"];
export type GetEmailTemplateDetailsRequestParams = z.infer<
  typeof getEmailTemplateDetailsRequestSchema
>["params"];
export type UpdateEmailTemplateRequestParams = z.infer<
  typeof updateEmailTemplateRequestSchema
>["params"];
export type UpdateEmailTemplateRequestBody = z.infer<
  typeof updateEmailTemplateRequestSchema
>["body"];
export type UpdateNotificationSettingsRequestParams = z.infer<
  typeof updateNotificationSettingsRequestSchema
>["params"];
export type UpdateNotificationSettingsRequestBody = z.infer<
  typeof updateNotificationSettingsRequestSchema
>["body"];
