import { model, Schema, type InferSchemaType, type Types } from "mongoose";

import { LINK_PLATFORMS } from "./link.model.js";

const adminPlatformMetricsDailySchema = new Schema(
  {
    date: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: [...LINK_PLATFORMS, "unknown"],
      required: true,
      default: "unknown",
    },
    clicks: { type: Number, default: 0, min: 0 },
    sessions: { type: Number, default: 0, min: 0 },
    avgDuration: { type: Number, default: 0, min: 0 },
    bounceRate: { type: Number, default: 0, min: 0, max: 1 },
    engagementScore: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "admin_platform_metrics_daily",
  },
);

adminPlatformMetricsDailySchema.index(
  { date: 1, platform: 1 },
  { unique: true, name: "uniq_admin_platform_metrics_daily" },
);
adminPlatformMetricsDailySchema.index(
  { platform: 1, date: 1 },
  { name: "admin_platform_metrics_platform_date_idx" },
);

export type AdminPlatformMetricsDailyDocument = InferSchemaType<
  typeof adminPlatformMetricsDailySchema
> & {
  _id: Types.ObjectId;
};

export const AdminPlatformMetricsDailyModel = model(
  "AdminPlatformMetricsDaily",
  adminPlatformMetricsDailySchema,
);

