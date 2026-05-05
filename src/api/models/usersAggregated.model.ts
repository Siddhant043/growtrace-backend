import { model, Schema, type InferSchemaType, type Types } from "mongoose";

const usersAggregatedSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userTrackingId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    totalSessions: {
      type: Number,
      default: 0,
      min: 0,
    },
    bounceSessions: {
      type: Number,
      default: 0,
      min: 0,
    },
    engagedSessions: {
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
    engagementScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    isReturning: {
      type: Boolean,
      default: false,
    },
    primaryPlatform: {
      type: String,
      default: "unknown",
      trim: true,
      index: true,
    },
    distinctPlatformCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    firstVisitAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastVisitAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "users_aggregated",
  },
);

usersAggregatedSchema.index(
  { userId: 1, userTrackingId: 1 },
  { unique: true },
);
usersAggregatedSchema.index({ userId: 1, engagementScore: -1 });
usersAggregatedSchema.index({ userId: 1, firstVisitAt: -1 });
usersAggregatedSchema.index({ engagementScore: -1 });
usersAggregatedSchema.index({ isReturning: 1 });
usersAggregatedSchema.index({ firstVisitAt: -1 });
usersAggregatedSchema.index({ primaryPlatform: 1, firstVisitAt: -1 });
usersAggregatedSchema.index({
  userId: 1,
  primaryPlatform: 1,
  firstVisitAt: -1,
});

export type UsersAggregatedDocument = InferSchemaType<
  typeof usersAggregatedSchema
> & {
  _id: Types.ObjectId;
};

export const UsersAggregatedModel = model(
  "UsersAggregated",
  usersAggregatedSchema,
);
