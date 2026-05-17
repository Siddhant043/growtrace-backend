import { z } from "zod";

import { LINK_PLATFORMS } from "../models/link.model.js";
import { linkIdOrShortCodeParamSchema } from "./linkParam.validator.js";

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format")
  .optional();

const linkPlatformSchema = z.enum(LINK_PLATFORMS);

const dateRangeQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
});

export const linkFunnelRequestSchema = z.object({
  params: z.object({
    linkId: linkIdOrShortCodeParamSchema,
  }),
  query: dateRangeQuerySchema,
});

export const platformFunnelRequestSchema = z.object({
  params: z.object({
    platform: linkPlatformSchema,
  }),
  query: dateRangeQuerySchema,
});

export const campaignFunnelRequestSchema = z.object({
  params: z.object({
    campaign: z.string().trim().min(1).max(120),
  }),
  query: dateRangeQuerySchema,
});

const funnelRangeFiltersQuerySchema = dateRangeQuerySchema.extend({
  platform: linkPlatformSchema.optional(),
  campaign: z.string().trim().min(1).max(120).optional(),
});

const pageQuerySchema = z.coerce.number().int().min(1).default(1);
const pageSizeQuerySchema = z.coerce.number().int().min(1).max(100).default(20);

export const funnelOverviewRequestSchema = z.object({
  query: funnelRangeFiltersQuerySchema,
});

export const funnelDailySeriesRequestSchema = z.object({
  query: funnelRangeFiltersQuerySchema,
});

export const listPlatformFunnelsRequestSchema = z.object({
  query: funnelRangeFiltersQuerySchema,
});

export const listLinkFunnelsRequestSchema = z.object({
  query: funnelRangeFiltersQuerySchema.extend({
    search: z.string().trim().max(200).optional(),
    page: pageQuerySchema.optional(),
    pageSize: pageSizeQuerySchema.optional(),
  }),
});

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
export type LinkFunnelRequestParams = z.infer<
  typeof linkFunnelRequestSchema
>["params"];
export type PlatformFunnelRequestParams = z.infer<
  typeof platformFunnelRequestSchema
>["params"];
export type CampaignFunnelRequestParams = z.infer<
  typeof campaignFunnelRequestSchema
>["params"];
export type ListLinkFunnelsRequestQuery = z.infer<
  typeof listLinkFunnelsRequestSchema
>["query"];
