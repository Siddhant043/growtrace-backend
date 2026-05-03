import { z } from "zod";

import { LINK_PLATFORMS } from "../models/link.model.js";

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format")
  .optional();

const objectIdParamSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "must be a 24-character hex ObjectId");

const linkPlatformSchema = z.enum(LINK_PLATFORMS);

const dateRangeQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
});

export const linkMetricsRequestSchema = z.object({
  params: z.object({
    linkId: objectIdParamSchema,
  }),
  query: dateRangeQuerySchema,
});

export const platformMetricsRequestSchema = z.object({
  params: z.object({
    platform: linkPlatformSchema,
  }),
  query: dateRangeQuerySchema,
});

export const campaignMetricsRequestSchema = z.object({
  params: z.object({
    campaign: z.string().trim().min(1).max(120),
  }),
  query: dateRangeQuerySchema,
});

export const listLinkMetricsRequestSchema = z.object({
  query: dateRangeQuerySchema.extend({
    platform: linkPlatformSchema.optional(),
    campaign: z.string().trim().min(1).max(120).optional(),
  }),
});

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
export type LinkMetricsRequestParams = z.infer<
  typeof linkMetricsRequestSchema
>["params"];
export type PlatformMetricsRequestParams = z.infer<
  typeof platformMetricsRequestSchema
>["params"];
export type CampaignMetricsRequestParams = z.infer<
  typeof campaignMetricsRequestSchema
>["params"];
export type ListLinkMetricsRequestQuery = z.infer<
  typeof listLinkMetricsRequestSchema
>["query"];
