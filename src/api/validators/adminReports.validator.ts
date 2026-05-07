import { z } from "zod";

import { REPORT_JOB_STATUSES } from "../models/reportJob.model.js";

const objectIdParamSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "must be a 24-character hex ObjectId");

const pageQuerySchema = z.coerce.number().int().min(1).default(1);
const limitQuerySchema = z.coerce.number().int().min(1).max(100).default(20);
const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");
const reportsSortBySchema = z
  .enum(["weekStart", "updatedAt", "deliveryStatus"])
  .default("weekStart");

const reportDeliveryStatusSchema = z.enum(["pending", "emailed", "failed", "skipped"]);
const reportJobStatusSchema = z.enum(REPORT_JOB_STATUSES);

export const listAdminReportsRequestSchema = z.object({
  query: z.object({
    page: pageQuerySchema.optional(),
    limit: limitQuerySchema.optional(),
    userId: objectIdParamSchema.optional(),
    status: reportDeliveryStatusSchema.optional(),
    sortBy: reportsSortBySchema.optional(),
    sortOrder: sortOrderSchema.optional(),
  }),
});

export const getAdminReportDetailsRequestSchema = z.object({
  params: z.object({
    id: objectIdParamSchema,
  }),
});

export const listAdminReportHistoryRequestSchema = z.object({
  params: z.object({
    userId: objectIdParamSchema,
  }),
  query: z.object({
    page: pageQuerySchema.optional(),
    limit: limitQuerySchema.optional(),
  }),
});

export const triggerAdminReportGenerationRequestSchema = z.object({
  params: z.object({
    userId: objectIdParamSchema,
  }),
});

export const listAdminReportJobsRequestSchema = z.object({
  query: z.object({
    page: pageQuerySchema.optional(),
    limit: limitQuerySchema.optional(),
    userId: objectIdParamSchema.optional(),
    status: reportJobStatusSchema.optional(),
  }),
});

export type ListAdminReportsRequestQuery = z.infer<
  typeof listAdminReportsRequestSchema
>["query"];
export type GetAdminReportDetailsRequestParams = z.infer<
  typeof getAdminReportDetailsRequestSchema
>["params"];
export type ListAdminReportHistoryRequestParams = z.infer<
  typeof listAdminReportHistoryRequestSchema
>["params"];
export type ListAdminReportHistoryRequestQuery = z.infer<
  typeof listAdminReportHistoryRequestSchema
>["query"];
export type TriggerAdminReportGenerationRequestParams = z.infer<
  typeof triggerAdminReportGenerationRequestSchema
>["params"];
export type ListAdminReportJobsRequestQuery = z.infer<
  typeof listAdminReportJobsRequestSchema
>["query"];
