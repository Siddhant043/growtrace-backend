import { z } from "zod";

import { INSIGHT_TYPES } from "../models/insightRead.model.js";

const objectIdParamSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "must be a 24-character hex ObjectId");

const pageQuerySchema = z.coerce.number().int().min(1).default(1);
const limitQuerySchema = z.coerce.number().int().min(1).max(50).default(20);

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format");

const insightJobIdSchema = z.string().trim().min(1).max(120);

export const listAdminInsightsRequestSchema = z.object({
  query: z.object({
    page: pageQuerySchema.optional(),
    limit: limitQuerySchema.optional(),
    type: z.enum(INSIGHT_TYPES).optional(),
    userId: z.string().trim().min(1).max(120).optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
  }),
});

export const listFailedAdminInsightsRequestSchema = z.object({
  query: z.object({
    page: pageQuerySchema.optional(),
    limit: limitQuerySchema.optional(),
  }),
});

export const retryAdminInsightJobRequestSchema = z.object({
  params: z.object({
    jobId: insightJobIdSchema,
  }),
});

export const getAdminInsightDetailsRequestSchema = z.object({
  params: z.object({
    insightId: objectIdParamSchema,
  }),
});

export type ListAdminInsightsRequestQuery = z.infer<
  typeof listAdminInsightsRequestSchema
>["query"];
export type ListFailedAdminInsightsRequestQuery = z.infer<
  typeof listFailedAdminInsightsRequestSchema
>["query"];
export type RetryAdminInsightJobRequestParams = z.infer<
  typeof retryAdminInsightJobRequestSchema
>["params"];
export type GetAdminInsightDetailsRequestParams = z.infer<
  typeof getAdminInsightDetailsRequestSchema
>["params"];

