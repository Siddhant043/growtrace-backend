import { z } from "zod";

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format");

const adminAnalyticsDateRangeQuerySchema = z.object({
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
});

export const listAdminPlatformMetricsRequestSchema = z.object({
  query: adminAnalyticsDateRangeQuerySchema,
});

export const listAdminUsageMetricsRequestSchema = z.object({
  query: adminAnalyticsDateRangeQuerySchema,
});

export const listAdminFunnelMetricsRequestSchema = z.object({
  query: adminAnalyticsDateRangeQuerySchema,
});

export type AdminAnalyticsDateRangeQuery = z.infer<
  typeof adminAnalyticsDateRangeQuerySchema
>;

