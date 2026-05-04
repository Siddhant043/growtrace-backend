import { model, Schema, type InferSchemaType, type Types } from "mongoose";

const campaignFunnelDailySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    campaign: {
      type: String,
      required: true,
      trim: true,
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

campaignFunnelDailySchema.index(
  { userId: 1, campaign: 1, date: 1 },
  { unique: true },
);
campaignFunnelDailySchema.index({ userId: 1, date: -1 });

export type CampaignFunnelDailyDocument = InferSchemaType<
  typeof campaignFunnelDailySchema
> & {
  _id: Types.ObjectId;
};

export const CampaignFunnelDailyModel = model(
  "CampaignFunnelDaily",
  campaignFunnelDailySchema,
);
