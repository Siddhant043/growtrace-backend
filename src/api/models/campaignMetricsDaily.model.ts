import { model, Schema, type InferSchemaType, type Types } from "mongoose";

const campaignMetricsDailySchema = new Schema(
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

campaignMetricsDailySchema.index(
  { userId: 1, campaign: 1, date: 1 },
  { unique: true },
);
campaignMetricsDailySchema.index({ userId: 1, date: -1 });

export type CampaignMetricsDailyDocument = InferSchemaType<
  typeof campaignMetricsDailySchema
> & {
  _id: Types.ObjectId;
};

export const CampaignMetricsDailyModel = model(
  "CampaignMetricsDaily",
  campaignMetricsDailySchema,
);
