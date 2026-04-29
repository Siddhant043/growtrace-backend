import { z } from "zod";

import { BEHAVIOR_EVENT_TYPES } from "../models/behaviorEvent.model";

const optionalTrimmedString = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .transform((stringValue) => stringValue ?? "");

const trackEventBodySchema = z.object({
  apiKey: z.string().trim().min(1, "apiKey is required").max(128),
  sessionId: z.string().trim().min(1, "sessionId is required").max(128),
  eventType: z.enum(BEHAVIOR_EVENT_TYPES),
  timestamp: z.coerce.number().int().nonnegative(),
  page: z
    .object({
      url: optionalTrimmedString,
      referrer: optionalTrimmedString,
    })
    .default({ url: "", referrer: "" }),
  device: z
    .object({
      userAgent: optionalTrimmedString,
      screen: optionalTrimmedString,
    })
    .default({ userAgent: "", screen: "" }),
  metrics: z
    .object({
      scrollDepth: z.number().min(0).max(100).optional(),
      duration: z.number().min(0).max(86_400).optional(),
    })
    .default({}),
  linkId: z
    .string()
    .trim()
    .max(64)
    .optional()
    .nullable()
    .transform((linkIdValue) =>
      linkIdValue && linkIdValue.length > 0 ? linkIdValue : null,
    ),
  isReturning: z.boolean().optional().default(false),
});

export const trackEventRequestSchema = z.object({
  body: trackEventBodySchema,
});

export type TrackEventRequestBody = z.infer<typeof trackEventBodySchema>;
