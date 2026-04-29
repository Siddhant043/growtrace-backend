import { z } from "zod";

import { LINK_PLATFORMS } from "../models/link.model";

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

export const linkFunnelRequestSchema = z.object({
  params: z.object({
    linkId: objectIdParamSchema,
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

export const listLinkFunnelsRequestSchema = z.object({
  query: dateRangeQuerySchema.extend({
    platform: linkPlatformSchema.optional(),
    campaign: z.string().trim().min(1).max(120).optional(),
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
