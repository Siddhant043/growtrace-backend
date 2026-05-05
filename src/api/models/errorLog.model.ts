import { model, Schema, type InferSchemaType, type Types } from "mongoose";

export const ERROR_LOG_SOURCES = ["api", "worker", "queue"] as const;
export const ERROR_LOG_SEVERITIES = ["low", "medium", "high"] as const;

export type ErrorLogSource = (typeof ERROR_LOG_SOURCES)[number];
export type ErrorLogSeverity = (typeof ERROR_LOG_SEVERITIES)[number];

const errorLogSchema = new Schema(
  {
    source: {
      type: String,
      enum: ERROR_LOG_SOURCES,
      required: true,
      index: true,
    },
    service: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    stack: {
      type: String,
      default: null,
      trim: true,
    },
    severity: {
      type: String,
      enum: ERROR_LOG_SEVERITIES,
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "error_logs",
  },
);

errorLogSchema.index({ createdAt: -1 });
errorLogSchema.index({ severity: 1 });
errorLogSchema.index({ source: 1 });
errorLogSchema.index({ service: 1 });

export type ErrorLogDocument = InferSchemaType<typeof errorLogSchema> & {
  _id: Types.ObjectId;
};

export const ErrorLogModel = model("ErrorLog", errorLogSchema);
