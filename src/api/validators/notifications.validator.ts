import { z } from "zod";

import { ALERT_TYPES } from "../models/alert.model";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{24}$/i, "must be a valid id");

export const listNotificationsRequestSchema = z.object({
  query: z
    .object({
      unreadOnly: z
        .union([z.literal("true"), z.literal("false")])
        .optional()
        .transform((value) => value === "true"),
      type: z
        .enum(["all", ...ALERT_TYPES] as [string, ...string[]])
        .optional()
        .default("all"),
      limit: z.coerce.number().int().min(1).max(100).optional().default(20),
      cursor: z.string().trim().min(1).max(64).optional(),
    })
    .default({ unreadOnly: false, type: "all", limit: 20 }),
});

export const getNotificationsUnreadCountRequestSchema = z.object({
  query: z.object({}).default({}),
});

export const markNotificationReadRequestSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const markAllNotificationsReadRequestSchema = z.object({
  body: z.object({}).default({}).optional(),
});

export const deleteNotificationRequestSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const getNotificationPreferencesRequestSchema = z.object({
  query: z.object({}).default({}),
});

export const updateNotificationPreferencesRequestSchema = z.object({
  body: z
    .object({
      emailEnabled: z.boolean().optional(),
      inAppEnabled: z.boolean().optional(),
      types: z
        .object({
          engagement_drop: z.boolean().optional(),
          traffic_spike: z.boolean().optional(),
          top_link: z.boolean().optional(),
        })
        .optional(),
    })
    .refine(
      (parsed) =>
        parsed.emailEnabled !== undefined ||
        parsed.inAppEnabled !== undefined ||
        parsed.types !== undefined,
      { message: "At least one preference field must be provided" },
    ),
});

export type ListNotificationsRequestQuery = z.infer<
  typeof listNotificationsRequestSchema
>["query"];

export type MarkNotificationReadRequestParams = z.infer<
  typeof markNotificationReadRequestSchema
>["params"];

export type DeleteNotificationRequestParams = z.infer<
  typeof deleteNotificationRequestSchema
>["params"];

export type UpdateNotificationPreferencesRequestBody = z.infer<
  typeof updateNotificationPreferencesRequestSchema
>["body"];
