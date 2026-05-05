import { model, Schema, type InferSchemaType, type Types } from "mongoose";

const queueMetricSchema = new Schema(
  {
    queueName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    pendingJobs: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    processingJobs: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    failedJobs: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    throughputPerSecond: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "queue_metrics",
  },
);

queueMetricSchema.index({ queueName: 1, timestamp: 1 }, { unique: true });

export type QueueMetricDocument = InferSchemaType<typeof queueMetricSchema> & {
  _id: Types.ObjectId;
};

export const QueueMetricModel = model("QueueMetric", queueMetricSchema);
