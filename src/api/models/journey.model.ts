import { model, Schema, type InferSchemaType, type Types } from "mongoose";

import { TOUCHPOINT_TYPES, type TouchpointType } from "./touchpoint.model";

const journeyTouchpointEmbedSchema = new Schema(
  {
    touchpointId: {
      type: Schema.Types.ObjectId,
      ref: "Touchpoint",
      required: true,
    },
    platform: { type: String, default: null, trim: true },
    type: { type: String, enum: TOUCHPOINT_TYPES, required: true },
    linkId: { type: Schema.Types.ObjectId, ref: "Link", default: null },
    sessionId: { type: String, default: null, trim: true },
    timestamp: { type: Date, required: true },
  },
  { _id: false },
);

const journeyTouchSummarySchema = new Schema(
  {
    platform: { type: String, default: null, trim: true },
    type: { type: String, enum: TOUCHPOINT_TYPES, default: null },
    linkId: { type: Schema.Types.ObjectId, ref: "Link", default: null },
    timestamp: { type: Date, default: null },
  },
  { _id: false },
);

const journeySchema = new Schema(
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
    touchpoints: {
      type: [journeyTouchpointEmbedSchema],
      default: [],
    },
    firstTouch: {
      type: journeyTouchSummarySchema,
      default: () => ({}),
    },
    lastTouch: {
      type: journeyTouchSummarySchema,
      default: () => ({}),
    },
    touchpointCount: { type: Number, default: 0 },
    distinctPlatformCount: { type: Number, default: 0 },
    isClosed: { type: Boolean, default: false, index: true },
    closedReason: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

journeySchema.index({ userTrackingId: 1, isClosed: 1, updatedAt: -1 });
journeySchema.index({ userId: 1, "firstTouch.timestamp": -1 });
journeySchema.index({ userId: 1, "lastTouch.platform": 1 });
journeySchema.index({ userId: 1, "firstTouch.platform": 1 });

export type JourneyEmbeddedTouchpoint = {
  touchpointId: Types.ObjectId;
  platform: string | null;
  type: TouchpointType;
  linkId: Types.ObjectId | null;
  sessionId: string | null;
  timestamp: Date;
};

export type JourneyDocument = InferSchemaType<typeof journeySchema> & {
  _id: Types.ObjectId;
};

export const JourneyModel = model("Journey", journeySchema);
