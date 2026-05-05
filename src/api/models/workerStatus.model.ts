import { model, Schema, type InferSchemaType, type Types } from "mongoose";

export const WORKER_STATUSES = ["healthy", "degraded", "down"] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

const workerStatusSchema = new Schema(
  {
    workerName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: WORKER_STATUSES,
      required: true,
      default: "healthy",
      index: true,
    },
    lastHeartbeatAt: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },
    jobsProcessed: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    jobsFailed: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "worker_status",
  },
);

workerStatusSchema.index({ workerName: 1 });
workerStatusSchema.index({ status: 1 });
workerStatusSchema.index({ lastHeartbeatAt: -1 });

export type WorkerStatusDocument = InferSchemaType<typeof workerStatusSchema> & {
  _id: Types.ObjectId;
};

export const WorkerStatusModel = model("WorkerStatus", workerStatusSchema);
