import { z } from "zod";

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format");

export const listReportsRequestSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(60).optional(),
    before: isoDateSchema.optional(),
  }),
});

export const getReportByWeekStartRequestSchema = z.object({
  params: z.object({
    weekStart: isoDateSchema,
  }),
});

export const previewReportRequestSchema = z.object({
  body: z
    .object({
      weekEndDate: isoDateSchema.optional(),
    })
    .default({}),
});

export type ListReportsRequestQuery = z.infer<
  typeof listReportsRequestSchema
>["query"];

export type GetReportByWeekStartRequestParams = z.infer<
  typeof getReportByWeekStartRequestSchema
>["params"];

export type PreviewReportRequestBody = z.infer<
  typeof previewReportRequestSchema
>["body"];
