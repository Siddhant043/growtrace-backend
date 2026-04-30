import { z } from "zod";

export const SUBSCRIPTION_PLAN_TIERS = ["monthly"] as const;
export type SubscriptionPlanTier = (typeof SUBSCRIPTION_PLAN_TIERS)[number];

export const createSubscriptionRequestSchema = z.object({
  body: z
    .object({
      planTier: z
        .enum(SUBSCRIPTION_PLAN_TIERS as unknown as [string, ...string[]])
        .default("monthly"),
    })
    .default({ planTier: "monthly" }),
});

export const cancelSubscriptionRequestSchema = z.object({
  body: z
    .object({
      cancelAtCycleEnd: z.boolean().optional().default(true),
    })
    .default({ cancelAtCycleEnd: true }),
});

export type CreateSubscriptionRequestBody = z.infer<
  typeof createSubscriptionRequestSchema
>["body"];

export type CancelSubscriptionRequestBody = z.infer<
  typeof cancelSubscriptionRequestSchema
>["body"];
