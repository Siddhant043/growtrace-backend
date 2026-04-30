import { model, Schema, type InferSchemaType, type Types } from "mongoose";

export const TOUCHPOINT_TYPES = [
  "click",
  "visit",
  "engaged",
  "conversion",
] as const;

export type TouchpointType = (typeof TOUCHPOINT_TYPES)[number];

const touchpointSchema = new Schema(
  {
    userTrackingId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    linkId: {
      type: Schema.Types.ObjectId,
      ref: "Link",
      default: null,
      index: true,
    },
    platform: {
      type: String,
      default: null,
      trim: true,
    },
    campaign: {
      type: String,
      default: null,
      trim: true,
    },
    type: {
      type: String,
      enum: TOUCHPOINT_TYPES,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    journeyId: {
      type: Schema.Types.ObjectId,
      ref: "Journey",
      default: null,
      index: true,
    },
    dedupeKey: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true, versionKey: false },
);

touchpointSchema.index({ dedupeKey: 1 }, { unique: true });
touchpointSchema.index({ userTrackingId: 1, timestamp: 1 });
touchpointSchema.index({ userId: 1, timestamp: -1 });

export type TouchpointDocument = InferSchemaType<typeof touchpointSchema> & {
  _id: Types.ObjectId;
};

export const TouchpointModel = model("Touchpoint", touchpointSchema);
