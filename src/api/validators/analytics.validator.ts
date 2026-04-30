import { z } from "zod";

import { LINK_PLATFORMS } from "../models/link.model";

const isoDateOptionalSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format")
  .optional();

const linkPlatformSchema = z.enum(LINK_PLATFORMS);

const trendRangeSchema = z
  .enum(["7d", "30d", "90d"])
  .optional()
  .default("7d");

const optionalCampaignSchema = z.string().trim().min(1).max(120).optional();

const optionalLimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(200)
  .optional();

const dateRangeWithRangeQuerySchema = z.object({
  range: trendRangeSchema,
  from: isoDateOptionalSchema,
  to: isoDateOptionalSchema,
});

export const engagementTrendsRequestSchema = z.object({
  query: dateRangeWithRangeQuerySchema.extend({
    platform: linkPlatformSchema.optional(),
    campaign: optionalCampaignSchema,
  }),
});

export const platformQualityRequestSchema = z.object({
  query: dateRangeWithRangeQuerySchema,
});

export const contentPerformanceRequestSchema = z.object({
  query: dateRangeWithRangeQuerySchema.extend({
    platform: linkPlatformSchema.optional(),
    campaign: optionalCampaignSchema,
    limit: optionalLimitSchema,
  }),
});

export type EngagementTrendsRequestQuery = z.infer<
  typeof engagementTrendsRequestSchema
>["query"];
export type PlatformQualityRequestQuery = z.infer<
  typeof platformQualityRequestSchema
>["query"];
export type ContentPerformanceRequestQuery = z.infer<
  typeof contentPerformanceRequestSchema
>["query"];

export type AnalyticsTrendRange = z.infer<typeof trendRangeSchema>;

const TREND_RANGE_TO_DAY_COUNT: Record<NonNullable<AnalyticsTrendRange>, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export const resolveDayCountForTrendRange = (
  trendRange: AnalyticsTrendRange,
): number => TREND_RANGE_TO_DAY_COUNT[trendRange ?? "7d"];
