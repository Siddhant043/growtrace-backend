import { model, Schema, type InferSchemaType, type Types } from "mongoose";

export const REPORT_JOB_STATUSES = [
  "pending",
  "processing",
  "generated",
  "failed",
] as const;

export type ReportJobStatus = (typeof REPORT_JOB_STATUSES)[number];

const reportJobSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    weekStart: {
      type: Date,
      required: true,
      index: true,
    },
    weekEnd: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: REPORT_JOB_STATUSES,
      required: true,
      default: "pending",
      index: true,
    },
    retryCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    error: {
      message: {
        type: String,
        trim: true,
        default: null,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "report_jobs",
  },
);

reportJobSchema.index({ userId: 1 });
reportJobSchema.index({ weekStart: -1 });
reportJobSchema.index({ status: 1 });
reportJobSchema.index({ userId: 1, weekStart: 1 }, { unique: true });

export type ReportJobDocument = InferSchemaType<typeof reportJobSchema> & {
  _id: Types.ObjectId;
};

export const ReportJobModel = model("ReportJob", reportJobSchema);
