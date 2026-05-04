import { z } from "zod";

export const getAttributionSummaryRequestSchema = z.object({
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
    })
    .default({}),
});

export const getAttributionRecentJourneysRequestSchema = z.object({
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    })
    .default({ limit: 20 }),
});

export const getAttributionJourneyDetailRequestSchema = z.object({
  params: z.object({
    userTrackingId: z.string().trim().min(8).max(64),
  }),
});

export type GetAttributionRecentJourneysRequestQuery = z.infer<
  typeof getAttributionRecentJourneysRequestSchema
>["query"];

export type GetAttributionJourneyDetailRequestParams = z.infer<
  typeof getAttributionJourneyDetailRequestSchema
>["params"];
