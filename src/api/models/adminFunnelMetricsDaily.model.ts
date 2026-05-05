import { model, Schema, type InferSchemaType, type Types } from "mongoose";

const adminFunnelMetricsDailySchema = new Schema(
  {
    date: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    signups: { type: Number, default: 0, min: 0 },
    activatedUsers: { type: Number, default: 0, min: 0 },
    proUsers: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "admin_funnel_metrics_daily",
  },
);

adminFunnelMetricsDailySchema.index({ date: 1 }, { name: "admin_funnel_metrics_date_idx" });

export type AdminFunnelMetricsDailyDocument = InferSchemaType<
  typeof adminFunnelMetricsDailySchema
> & {
  _id: Types.ObjectId;
};

export const AdminFunnelMetricsDailyModel = model(
  "AdminFunnelMetricsDaily",
  adminFunnelMetricsDailySchema,
);

