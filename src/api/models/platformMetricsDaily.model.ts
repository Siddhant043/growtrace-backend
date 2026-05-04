import { model, Schema, type InferSchemaType, type Types } from "mongoose";

import { LINK_PLATFORMS } from "./link.model.js";

const platformMetricsDailySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    platform: {
      type: String,
      enum: LINK_PLATFORMS,
      required: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
    },
    totalSessions: { type: Number, default: 0, min: 0 },
    bounceSessions: { type: Number, default: 0, min: 0 },
    engagedSessions: { type: Number, default: 0, min: 0 },
    totalDuration: { type: Number, default: 0, min: 0 },
    totalScrollDepth: { type: Number, default: 0, min: 0 },
    avgDuration: { type: Number, default: 0, min: 0 },
    avgScrollDepth: { type: Number, default: 0, min: 0 },
    bounceRate: { type: Number, default: 0, min: 0, max: 1 },
    engagementScore: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

platformMetricsDailySchema.index(
  { userId: 1, platform: 1, date: 1 },
  { unique: true },
);
platformMetricsDailySchema.index({ userId: 1, date: -1 });

export type PlatformMetricsDailyDocument = InferSchemaType<
  typeof platformMetricsDailySchema
> & {
  _id: Types.ObjectId;
};

export const PlatformMetricsDailyModel = model(
  "PlatformMetricsDaily",
  platformMetricsDailySchema,
);
