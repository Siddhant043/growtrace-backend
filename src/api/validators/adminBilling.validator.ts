import { z } from "zod";

import { SUBSCRIPTION_STATUSES } from "../models/user.model.js";
import { PAYMENT_STATUSES } from "../models/payment.model.js";

const objectIdParamSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "must be a 24-character hex ObjectId");

const pageQuerySchema = z.coerce.number().int().min(1).default(1);
const limitQuerySchema = z.coerce.number().int().min(1).max(100).default(20);
const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");
const subscriptionsSortBySchema = z
  .enum(["createdAt", "currentPeriodEnd", "status"])
  .default("createdAt");
const paymentsSortBySchema = z
  .enum(["createdAt", "amount", "status"])
  .default("createdAt");

const ADMIN_SUBSCRIPTION_FILTER_STATUSES = SUBSCRIPTION_STATUSES.filter(
  (status) => status === "active" || status === "cancelled" || status === "expired",
) as ["active", "cancelled", "expired"];

const isoDateStringSchema = z
  .string()
  .trim()
  .datetime("must be a valid ISO date string");

export const listAdminSubscriptionsRequestSchema = z.object({
  query: z
    .object({
      page: pageQuerySchema.optional(),
      limit: limitQuerySchema.optional(),
      status: z.enum(ADMIN_SUBSCRIPTION_FILTER_STATUSES).optional(),
      search: z.string().trim().min(1).max(120).optional(),
      sortBy: subscriptionsSortBySchema.optional(),
      sortOrder: sortOrderSchema.optional(),
    })
    .optional(),
});

export const getAdminSubscriptionDetailsRequestSchema = z.object({
  params: z.object({
    subscriptionId: objectIdParamSchema,
  }),
});

export const listAdminPaymentsRequestSchema = z.object({
  query: z
    .object({
      page: pageQuerySchema.optional(),
      limit: limitQuerySchema.optional(),
      status: z.enum(PAYMENT_STATUSES).optional(),
      userId: objectIdParamSchema.optional(),
      fromDate: isoDateStringSchema.optional(),
      toDate: isoDateStringSchema.optional(),
      sortBy: paymentsSortBySchema.optional(),
      sortOrder: sortOrderSchema.optional(),
    })
    .optional(),
});

export const listFailedPaymentsRequestSchema = z.object({
  query: z
    .object({
      page: pageQuerySchema.optional(),
      limit: limitQuerySchema.optional(),
      userId: objectIdParamSchema.optional(),
      fromDate: isoDateStringSchema.optional(),
      toDate: isoDateStringSchema.optional(),
      sortBy: paymentsSortBySchema.optional(),
      sortOrder: sortOrderSchema.optional(),
    })
    .optional(),
});

export type ListAdminSubscriptionsRequestQuery = z.infer<
  typeof listAdminSubscriptionsRequestSchema
>["query"];
export type GetAdminSubscriptionDetailsRequestParams = z.infer<
  typeof getAdminSubscriptionDetailsRequestSchema
>["params"];
export type ListAdminPaymentsRequestQuery = z.infer<
  typeof listAdminPaymentsRequestSchema
>["query"];
export type ListFailedPaymentsRequestQuery = z.infer<
  typeof listFailedPaymentsRequestSchema
>["query"];

