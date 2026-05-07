import { z } from "zod";

import { ALERT_TYPES } from "../models/alert.model.js";

const objectIdParamSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "must be a 24-character hex ObjectId");

const pageQuerySchema = z.coerce.number().int().min(1).default(1);
const limitQuerySchema = z.coerce.number().int().min(1).max(50).default(20);
const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");
const alertsSortBySchema = z.enum(["createdAt", "type"]).default("createdAt");
const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format");

export const listAdminAlertsRequestSchema = z.object({
  query: z.object({
    page: pageQuerySchema.optional(),
    limit: limitQuerySchema.optional(),
    type: z.enum(ALERT_TYPES).optional(),
    userId: z.string().trim().regex(/^[a-f\d]{24}$/i).optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    sortBy: alertsSortBySchema.optional(),
    sortOrder: sortOrderSchema.optional(),
  }),
});

export const getAdminAlertDetailsRequestSchema = z.object({
  params: z.object({
    alertId: objectIdParamSchema,
  }),
});

export const listAdminAlertSettingsRequestSchema = z.object({
  query: z.object({}).default({}),
});

export const updateAdminAlertSettingsRequestSchema = z.object({
  params: z.object({
    type: z.enum(ALERT_TYPES),
  }),
  body: z
    .object({
      enabled: z.boolean().optional(),
      thresholds: z
        .object({
          dropPercent: z.coerce.number().min(0).max(100).optional(),
          spikeMultiplier: z.coerce.number().min(1).max(10).optional(),
        })
        .optional(),
      cooldownHours: z.coerce.number().int().min(1).max(168).optional(),
    })
    .refine(
      (body) =>
        body.enabled !== undefined ||
        body.thresholds !== undefined ||
        body.cooldownHours !== undefined,
      { message: "At least one settings field is required" },
    ),
});

export type ListAdminAlertsRequestQuery = z.infer<
  typeof listAdminAlertsRequestSchema
>["query"];
export type GetAdminAlertDetailsRequestParams = z.infer<
  typeof getAdminAlertDetailsRequestSchema
>["params"];
export type UpdateAdminAlertSettingsRequestParams = z.infer<
  typeof updateAdminAlertSettingsRequestSchema
>["params"];
export type UpdateAdminAlertSettingsRequestBody = z.infer<
  typeof updateAdminAlertSettingsRequestSchema
>["body"];

