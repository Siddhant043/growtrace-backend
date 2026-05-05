import { model, Schema, type InferSchemaType, type Types } from "mongoose";

export const INSIGHT_JOB_STATUSES = [
  "pending",
  "processing",
  "success",
  "failed",
] as const;

export type InsightJobStatus = (typeof INSIGHT_JOB_STATUSES)[number];

const insightJobSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    jobId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    status: {
      type: String,
      enum: INSIGHT_JOB_STATUSES,
      required: true,
      default: "pending",
      index: true,
    },
    error: {
      message: { type: String, trim: true, default: null },
      stack: { type: String, trim: true, default: null },
    },
    payload: {
      type: Schema.Types.Mixed,
      default: null,
    },
    retryCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    processingDurationMs: {
      type: Number,
      default: null,
      min: 0,
    },
    lastRetriedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "insight_jobs",
  },
);

insightJobSchema.index({ createdAt: -1 });

export type InsightJobDocument = InferSchemaType<typeof insightJobSchema> & {
  _id: Types.ObjectId;
};

export const InsightJobModel = model("InsightJob", insightJobSchema);

