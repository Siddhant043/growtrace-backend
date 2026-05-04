import { model, Schema, type InferSchemaType, type Types } from "mongoose";

import { LINK_PLATFORMS } from "./link.model.js";

const platformFunnelDailySchema = new Schema(
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
    clicks: { type: Number, default: 0, min: 0 },
    visits: { type: Number, default: 0, min: 0 },
    engaged: { type: Number, default: 0, min: 0 },
    visitRate: { type: Number, default: 0, min: 0 },
    engagementRate: { type: Number, default: 0, min: 0, max: 1 },
    dropClickToVisit: { type: Number, default: 0 },
    dropVisitToEngaged: { type: Number, default: 0, min: 0, max: 1 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

platformFunnelDailySchema.index(
  { userId: 1, platform: 1, date: 1 },
  { unique: true },
);
platformFunnelDailySchema.index({ userId: 1, date: -1 });

export type PlatformFunnelDailyDocument = InferSchemaType<
  typeof platformFunnelDailySchema
> & {
  _id: Types.ObjectId;
};

export const PlatformFunnelDailyModel = model(
  "PlatformFunnelDaily",
  platformFunnelDailySchema,
);
