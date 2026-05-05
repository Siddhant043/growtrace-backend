import { z } from "zod";

import { ACCOUNT_STATUSES, SUBSCRIPTION_TYPES } from "../models/user.model.js";

const objectIdParamSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "must be a 24-character hex ObjectId");

const pageQuerySchema = z.coerce.number().int().min(1).default(1);
const limitQuerySchema = z.coerce.number().int().min(1).max(50).default(20);

export const listAdminUsersRequestSchema = z.object({
  query: z.object({
    page: pageQuerySchema.optional(),
    limit: limitQuerySchema.optional(),
    search: z.string().trim().min(1).max(120).optional(),
    status: z.enum(ACCOUNT_STATUSES).optional(),
    plan: z.enum(SUBSCRIPTION_TYPES).optional(),
  }),
});

export const getAdminUserDetailRequestSchema = z.object({
  params: z.object({
    userId: objectIdParamSchema,
  }),
});

export const updateAdminUserStatusRequestSchema = z.object({
  params: z.object({
    userId: objectIdParamSchema,
  }),
  body: z.object({
    status: z.enum(ACCOUNT_STATUSES),
  }),
});

export const updateAdminUserPlanRequestSchema = z.object({
  params: z.object({
    userId: objectIdParamSchema,
  }),
  body: z.object({
    plan: z.enum(SUBSCRIPTION_TYPES),
  }),
});

export type ListAdminUsersRequestQuery = z.infer<
  typeof listAdminUsersRequestSchema
>["query"];
export type GetAdminUserDetailRequestParams = z.infer<
  typeof getAdminUserDetailRequestSchema
>["params"];
export type UpdateAdminUserStatusRequestParams = z.infer<
  typeof updateAdminUserStatusRequestSchema
>["params"];
export type UpdateAdminUserStatusRequestBody = z.infer<
  typeof updateAdminUserStatusRequestSchema
>["body"];
export type UpdateAdminUserPlanRequestParams = z.infer<
  typeof updateAdminUserPlanRequestSchema
>["params"];
export type UpdateAdminUserPlanRequestBody = z.infer<
  typeof updateAdminUserPlanRequestSchema
>["body"];

