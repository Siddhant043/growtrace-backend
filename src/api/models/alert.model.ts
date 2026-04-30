import { model, Schema, type InferSchemaType, type Types } from "mongoose";

export const ALERT_TYPES = [
  "engagement_drop",
  "traffic_spike",
  "top_link",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_CHANNELS = ["in-app", "email"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export const ALERT_EMAIL_STATUSES = [
  "pending",
  "sent",
  "skipped",
  "failed",
] as const;
export type AlertEmailStatus = (typeof ALERT_EMAIL_STATUSES)[number];

export const ALERT_SOURCES = ["rule", "ai"] as const;
export type AlertSource = (typeof ALERT_SOURCES)[number];

const alertSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ALERT_TYPES,
      required: true,
    },
    headline: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
    channels: {
      type: [String],
      enum: ALERT_CHANNELS,
      default: ["in-app"],
    },
    emailStatus: {
      type: String,
      enum: ALERT_EMAIL_STATUSES,
      default: "pending",
    },
    emailError: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    dedupeKey: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      enum: ALERT_SOURCES,
      default: "rule",
    },
    deepLinkPath: {
      type: String,
      default: null,
      trim: true,
    },
    occurredAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "alerts",
  },
);

alertSchema.index({ userId: 1, createdAt: -1 });
alertSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
alertSchema.index({ userId: 1, type: 1, createdAt: -1 });
alertSchema.index({ type: 1 });
alertSchema.index({ dedupeKey: 1 }, { unique: true });

export type AlertDocument = InferSchemaType<typeof alertSchema> & {
  _id: Types.ObjectId;
};

export const AlertModel = model("Alert", alertSchema);
