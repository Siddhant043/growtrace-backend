import { model, Schema, type InferSchemaType, type Types } from "mongoose";

export const WEEKLY_REPORT_DELIVERY_STATUSES = [
  "pending",
  "emailed",
  "failed",
  "skipped",
] as const;

export type WeeklyReportDeliveryStatus =
  (typeof WEEKLY_REPORT_DELIVERY_STATUSES)[number];

const trendBucketSchema = new Schema(
  {
    date: { type: Date, required: true },
    engagementScore: { type: Number, default: 0 },
    avgDuration: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { _id: false },
);

const insightEntrySchema = new Schema(
  {
    insightId: { type: Schema.Types.ObjectId, default: null },
    type: { type: String, required: true },
    message: { type: String, required: true },
    confidence: { type: Number, default: 0 },
  },
  { _id: false },
);

const recommendationEntrySchema = new Schema(
  {
    insightId: { type: Schema.Types.ObjectId, default: null },
    message: { type: String, required: true },
    confidence: { type: Number, default: 0 },
  },
  { _id: false },
);

const topPlatformSchema = new Schema(
  {
    platform: { type: String, default: null },
    engagementScore: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    sessions: { type: Number, default: 0 },
  },
  { _id: false },
);

const topContentSchema = new Schema(
  {
    linkId: { type: Schema.Types.ObjectId, default: null },
    shortCode: { type: String, default: null },
    title: { type: String, default: null },
    engagementScore: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { _id: false },
);

const summarySchema = new Schema(
  {
    headline: { type: String, default: "" },
    deltaPct: { type: Number, default: 0 },
    isFirstReport: { type: Boolean, default: false },
    isMinimal: { type: Boolean, default: false },
  },
  { _id: false },
);

const weeklyReportSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    topPlatform: { type: topPlatformSchema, default: () => ({}) },
    topContent: { type: topContentSchema, default: () => ({}) },
    trends: { type: [trendBucketSchema], default: [] },
    insights: { type: [insightEntrySchema], default: [] },
    recommendations: { type: [recommendationEntrySchema], default: [] },
    summary: { type: summarySchema, default: () => ({}) },
    deliveryStatus: {
      type: String,
      enum: WEEKLY_REPORT_DELIVERY_STATUSES,
      default: "pending",
      index: true,
    },
    emailMessageId: { type: String, default: null },
    failureReason: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

weeklyReportSchema.index({ userId: 1, weekStart: -1 }, { unique: true });
weeklyReportSchema.index({ deliveryStatus: 1, weekStart: -1 });

export type WeeklyReportDocument = InferSchemaType<typeof weeklyReportSchema> & {
  _id: Types.ObjectId;
};

export const WeeklyReportModel = model("WeeklyReport", weeklyReportSchema);
