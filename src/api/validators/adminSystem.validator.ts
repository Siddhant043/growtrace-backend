import { z } from "zod";

import {
  ERROR_LOG_SEVERITIES,
  ERROR_LOG_SOURCES,
} from "../models/errorLog.model.js";

const objectIdParamSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "must be a 24-character hex ObjectId");

const pageQuerySchema = z.coerce.number().int().min(1).default(1);
const limitQuerySchema = z.coerce.number().int().min(1).max(100).default(20);
const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format");

export const listAdminSystemQueuesRequestSchema = z.object({
  query: z.object({}).default({}),
});

export const listAdminSystemWorkersRequestSchema = z.object({
  query: z.object({}).default({}),
});

export const listAdminSystemErrorsRequestSchema = z.object({
  query: z.object({
    page: pageQuerySchema.optional(),
    limit: limitQuerySchema.optional(),
    severity: z.enum(ERROR_LOG_SEVERITIES).optional(),
    source: z.enum(ERROR_LOG_SOURCES).optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
  }),
});

export const getAdminSystemErrorDetailsRequestSchema = z.object({
  params: z.object({
    id: objectIdParamSchema,
  }),
});

export type ListAdminSystemErrorsRequestQuery = z.infer<
  typeof listAdminSystemErrorsRequestSchema
>["query"];
export type GetAdminSystemErrorDetailsRequestParams = z.infer<
  typeof getAdminSystemErrorDetailsRequestSchema
>["params"];
