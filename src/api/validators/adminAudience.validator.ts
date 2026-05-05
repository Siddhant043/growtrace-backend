import { z } from "zod";

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format");

const pageQuerySchema = z.coerce.number().int().min(1).default(1);
const limitQuerySchema = z.coerce.number().int().min(1).max(100).default(20);

export const getAdminAudienceSegmentsRequestSchema = z.object({
  query: z.object({}).default({}),
});

export const getAdminAudienceCohortsRequestSchema = z.object({
  query: z.object({
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    platform: z.string().trim().min(1).max(64).optional(),
    page: pageQuerySchema.optional(),
    limit: limitQuerySchema.optional(),
  }),
});

export type GetAdminAudienceCohortsRequestQuery = z.infer<
  typeof getAdminAudienceCohortsRequestSchema
>["query"];
