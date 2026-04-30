import { z } from "zod";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const getAudienceSegmentsRequestSchema = z.object({
  query: z
    .object({
      range: z.enum(["7d", "30d", "90d"]).optional().default("30d"),
    })
    .default({ range: "30d" }),
});

export const getAudienceCohortsRequestSchema = z.object({
  query: z
    .object({
      from: z
        .string()
        .trim()
        .regex(ISO_DATE_REGEX, "from must be YYYY-MM-DD")
        .optional(),
      to: z
        .string()
        .trim()
        .regex(ISO_DATE_REGEX, "to must be YYYY-MM-DD")
        .optional(),
      platform: z.string().trim().min(1).max(64).optional(),
      limit: z.coerce.number().int().min(1).max(1000).optional().default(200),
    })
    .default({ limit: 200 }),
});

export const getAudienceUsersRequestSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).optional().default(1),
      pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
      segment: z
        .enum([
          "all",
          "highEngagement",
          "lowEngagement",
          "midEngagement",
          "returning",
        ])
        .optional()
        .default("all"),
      platform: z.string().trim().min(1).max(64).optional(),
      sortBy: z
        .enum([
          "engagementScore",
          "totalSessions",
          "lastVisitAt",
          "firstVisitAt",
        ])
        .optional()
        .default("engagementScore"),
    })
    .default({
      page: 1,
      pageSize: 25,
      segment: "all",
      sortBy: "engagementScore",
    }),
});

export const getAudienceInsightsRequestSchema = z.object({
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(50).optional().default(10),
    })
    .default({ limit: 10 }),
});

export const getAudienceEngagementHistogramRequestSchema = z.object({
  query: z.object({}).default({}),
});

export type GetAudienceSegmentsRequestQuery = z.infer<
  typeof getAudienceSegmentsRequestSchema
>["query"];

export type GetAudienceCohortsRequestQuery = z.infer<
  typeof getAudienceCohortsRequestSchema
>["query"];

export type GetAudienceUsersRequestQuery = z.infer<
  typeof getAudienceUsersRequestSchema
>["query"];

export type GetAudienceInsightsRequestQuery = z.infer<
  typeof getAudienceInsightsRequestSchema
>["query"];
