import { z } from "zod";

import { INSIGHT_TYPES } from "../models/insightRead.model.js";

const objectIdParamSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "must be a 24-character hex ObjectId");

const pageQuerySchema = z.coerce.number().int().min(1).default(1);
const limitQuerySchema = z.coerce.number().int().min(1).max(50).default(20);
const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");
const insightsSortBySchema = z
  .enum(["createdAt", "confidence", "type"])
  .default("createdAt");

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format");

export const listUserInsightsRequestSchema = z.object({
  query: z.object({
    page: pageQuerySchema.optional(),
    limit: limitQuerySchema.optional(),
    type: z.enum(INSIGHT_TYPES).optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    sortBy: insightsSortBySchema.optional(),
    sortOrder: sortOrderSchema.optional(),
  }),
});

export const getUserInsightDetailsRequestSchema = z.object({
  params: z.object({
    insightId: objectIdParamSchema,
  }),
});

export type ListUserInsightsRequestQuery = z.infer<
  typeof listUserInsightsRequestSchema
>["query"];
export type GetUserInsightDetailsRequestParams = z.infer<
  typeof getUserInsightDetailsRequestSchema
>["params"];
