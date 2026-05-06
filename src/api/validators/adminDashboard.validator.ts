import { z } from "zod";

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format");

const pageQuerySchema = z.coerce.number().int().min(1).default(1);
const limitQuerySchema = z.coerce.number().int().min(1).max(50).default(10);
const chartLimitQuerySchema = z.coerce.number().int().min(1).max(90).default(14);

export const getAdminDashboardRequestSchema = z.object({
  query: z.object({
    chartStartDate: isoDateSchema.optional(),
    chartEndDate: isoDateSchema.optional(),
    chartPage: pageQuerySchema.optional(),
    chartLimit: chartLimitQuerySchema.optional(),
    activityCursor: z.string().trim().datetime().optional(),
    activityLimit: limitQuerySchema.optional(),
    alertsPage: pageQuerySchema.optional(),
    alertsLimit: limitQuerySchema.optional(),
  }),
});

export type GetAdminDashboardRequestQuery = z.infer<
  typeof getAdminDashboardRequestSchema
>["query"];
