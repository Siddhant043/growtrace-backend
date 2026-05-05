import { model, Schema, type InferSchemaType, type Types } from "mongoose";

const cohortMetricsDailySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cohortDate: {
      type: String,
      required: true,
      trim: true,
    },
    primaryPlatform: {
      type: String,
      required: true,
      trim: true,
    },
    users: {
      type: Number,
      default: 0,
      min: 0,
    },
    returningUsers: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgEngagement: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgDuration: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgScrollDepth: {
      type: Number,
      default: 0,
      min: 0,
    },
    bounceRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    highEngagementUsers: {
      type: Number,
      default: 0,
      min: 0,
    },
    lowEngagementUsers: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "cohort_metrics_daily",
  },
);

cohortMetricsDailySchema.index(
  { userId: 1, cohortDate: 1, primaryPlatform: 1 },
  { unique: true },
);
cohortMetricsDailySchema.index({ userId: 1, cohortDate: -1 });
cohortMetricsDailySchema.index({ userId: 1, primaryPlatform: 1 });
cohortMetricsDailySchema.index({ cohortDate: 1 });
cohortMetricsDailySchema.index({ primaryPlatform: 1 });
cohortMetricsDailySchema.index({ cohortDate: 1, primaryPlatform: 1 });

export type CohortMetricsDailyDocument = InferSchemaType<
  typeof cohortMetricsDailySchema
> & {
  _id: Types.ObjectId;
};

export const CohortMetricsDailyModel = model(
  "CohortMetricsDaily",
  cohortMetricsDailySchema,
);
