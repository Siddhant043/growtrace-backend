import { model, Schema, type InferSchemaType, type Types } from "mongoose";

const adminUsageMetricsDailySchema = new Schema(
  {
    date: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    newUsers: { type: Number, default: 0, min: 0 },
    activeUsers: { type: Number, default: 0, min: 0 },
    totalLinksCreated: { type: Number, default: 0, min: 0 },
    totalClicks: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "admin_usage_metrics_daily",
  },
);

adminUsageMetricsDailySchema.index({ date: 1 }, { name: "admin_usage_metrics_date_idx" });

export type AdminUsageMetricsDailyDocument = InferSchemaType<
  typeof adminUsageMetricsDailySchema
> & {
  _id: Types.ObjectId;
};

export const AdminUsageMetricsDailyModel = model(
  "AdminUsageMetricsDaily",
  adminUsageMetricsDailySchema,
);

