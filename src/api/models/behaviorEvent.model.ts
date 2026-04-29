import { model, Schema, type InferSchemaType, type Types } from "mongoose";

export const BEHAVIOR_EVENT_TYPES = ["page_view", "scroll", "exit"] as const;
export type BehaviorEventType = (typeof BEHAVIOR_EVENT_TYPES)[number];

const behaviorEventSchema = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    linkId: {
      type: Schema.Types.ObjectId,
      ref: "Link",
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      enum: BEHAVIOR_EVENT_TYPES,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    page: {
      url: { type: String, trim: true, default: "" },
      referrer: { type: String, trim: true, default: "" },
    },
    device: {
      userAgent: { type: String, trim: true, default: "" },
      screen: { type: String, trim: true, default: "" },
    },
    metrics: {
      scrollDepth: { type: Number, default: null, min: 0, max: 100 },
      duration: { type: Number, default: null, min: 0 },
    },
    country: {
      type: String,
      trim: true,
      default: "IN",
    },
  },
  {
    versionKey: false,
  },
);

behaviorEventSchema.index({ userId: 1, timestamp: -1 });
behaviorEventSchema.index({ sessionId: 1, timestamp: -1 });

export type BehaviorEventDocument = InferSchemaType<typeof behaviorEventSchema> & {
  _id: Types.ObjectId;
};

export const BehaviorEventModel = model("BehaviorEvent", behaviorEventSchema);
