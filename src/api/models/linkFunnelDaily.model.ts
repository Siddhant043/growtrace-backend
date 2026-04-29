import { model, Schema, type InferSchemaType, type Types } from "mongoose";

import { LINK_PLATFORMS } from "./link.model";

const linkFunnelDailySchema = new Schema(
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

linkFunnelDailySchema.index(
  { userId: 1, linkId: 1, date: 1 },
  { unique: true },
);
linkFunnelDailySchema.index({ userId: 1, date: -1 });
linkFunnelDailySchema.index({ linkId: 1, date: -1 });
linkFunnelDailySchema.index({ userId: 1, platform: 1, date: -1 });
linkFunnelDailySchema.index({ userId: 1, campaign: 1, date: -1 });

export type LinkFunnelDailyDocument = InferSchemaType<
  typeof linkFunnelDailySchema
> & {
  _id: Types.ObjectId;
};

export const LinkFunnelDailyModel = model(
  "LinkFunnelDaily",
  linkFunnelDailySchema,
);
