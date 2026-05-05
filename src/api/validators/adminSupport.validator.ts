import { z } from "zod";

import { BEHAVIOR_EVENT_TYPES } from "../models/behaviorEvent.model.js";

const trackingIdParamSchema = z.string().trim().min(1).max(256);
const sessionIdSchema = z.string().trim().min(1).max(256);
const objectIdParamSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "must be a 24-character hex ObjectId");
const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format");
const pageQuerySchema = z.coerce.number().int().min(1).default(1);
const limitQuerySchema = z.coerce.number().int().min(1).max(100).default(20);

export const getAdminUserActivityRequestSchema = z.object({
  params: z.object({
    userTrackingId: trackingIdParamSchema,
  }),
  query: z.object({
    page: pageQuerySchema.optional(),
    pageSize: limitQuerySchema.optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    maxEventsPerSession: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const listAdminSupportEventsRequestSchema = z.object({
  query: z.object({
    page: pageQuerySchema.optional(),
    limit: limitQuerySchema.optional(),
    userTrackingId: trackingIdParamSchema.optional(),
    sessionId: sessionIdSchema.optional(),
    eventType: z.enum(BEHAVIOR_EVENT_TYPES).optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
  }),
});

export const getAdminSupportEventDetailsRequestSchema = z.object({
  params: z.object({
    id: objectIdParamSchema,
  }),
});

export type GetAdminUserActivityRequestParams = z.infer<
  typeof getAdminUserActivityRequestSchema
>["params"];
export type GetAdminUserActivityRequestQuery = z.infer<
  typeof getAdminUserActivityRequestSchema
>["query"];
export type ListAdminSupportEventsRequestQuery = z.infer<
  typeof listAdminSupportEventsRequestSchema
>["query"];
export type GetAdminSupportEventDetailsRequestParams = z.infer<
  typeof getAdminSupportEventDetailsRequestSchema
>["params"];
