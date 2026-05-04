import { model, Schema, type InferSchemaType, type Types } from "mongoose";

import { LINK_PLATFORMS } from "./link.model.js";

const linkMetricsDailySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    linkId: {
      type: Schema.Types.ObjectId,
      ref: "Link",
      required: true,
    },
    platform: {
      type: String,
      enum: LINK_PLATFORMS,
      default: null,
    },
    campaign: {
      type: String,
      trim: true,
      default: null,
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

linkMetricsDailySchema.index(
  { userId: 1, linkId: 1, date: 1 },
  { unique: true },
);
linkMetricsDailySchema.index({ userId: 1, date: -1 });
linkMetricsDailySchema.index({ linkId: 1, date: -1 });
linkMetricsDailySchema.index({ userId: 1, platform: 1, date: -1 });
linkMetricsDailySchema.index({ userId: 1, campaign: 1, date: -1 });

export type LinkMetricsDailyDocument = InferSchemaType<
  typeof linkMetricsDailySchema
> & {
  _id: Types.ObjectId;
};

export const LinkMetricsDailyModel = model(
  "LinkMetricsDaily",
  linkMetricsDailySchema,
);
