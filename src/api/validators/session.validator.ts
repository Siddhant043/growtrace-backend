import { z } from "zod";

import { LINK_PLATFORMS } from "../models/link.model.js";

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format")
  .optional();

const objectIdQuerySchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "must be a 24-character hex ObjectId")
  .optional();

const linkPlatformSchema = z.enum(LINK_PLATFORMS).optional();

const positiveIntegerStringSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "must be a positive integer")
  .transform((numericString) => Number.parseInt(numericString, 10))
  .refine(
    (parsedNumber) => Number.isFinite(parsedNumber) && parsedNumber >= 1,
    "must be at least 1",
  )
  .optional();

export const listSessionsRequestSchema = z.object({
  query: z.object({
    from: isoDateSchema,
    to: isoDateSchema,
    linkId: objectIdQuerySchema,
    platform: linkPlatformSchema,
    campaign: z.string().trim().min(1).max(120).optional(),
    page: positiveIntegerStringSchema,
    pageSize: positiveIntegerStringSchema,
  }),
});

export const getSessionDetailRequestSchema = z.object({
  params: z.object({
    sessionId: z.string().trim().min(1).max(128),
  }),
});

export type ListSessionsRequestQuery = z.infer<
  typeof listSessionsRequestSchema
>["query"];
export type GetSessionDetailRequestParams = z.infer<
  typeof getSessionDetailRequestSchema
>["params"];
