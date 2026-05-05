import { model, Schema, type InferSchemaType, type Types } from "mongoose";

import { DEVICE_TYPES } from "./clickEvent.model.js";
import { LINK_PLATFORMS } from "./link.model.js";

const sessionSchema = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
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
    platform: {
      type: String,
      enum: LINK_PLATFORMS,
      default: null,
      index: true,
    },
    campaign: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    firstClickAt: {
      type: Date,
      default: null,
    },
    firstVisitAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxScrollDepth: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isBounce: {
      type: Boolean,
      default: true,
    },
    isReturning: {
      type: Boolean,
      default: false,
    },
    entryUrl: {
      type: String,
      trim: true,
      default: "",
    },
    referrer: {
      type: String,
      trim: true,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      default: "IN",
    },
    deviceType: {
      type: String,
      enum: DEVICE_TYPES,
      default: "desktop",
    },
    browser: {
      type: String,
      trim: true,
      default: "unknown",
    },
    userAgent: {
      type: String,
      trim: true,
      default: "",
    },
    userTrackingId: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

sessionSchema.index({ userId: 1, lastActivityAt: -1 });
sessionSchema.index({ userId: 1, createdAt: -1, platform: 1 });
sessionSchema.index({ userId: 1, createdAt: -1, campaign: 1 });
sessionSchema.index({ userId: 1, userTrackingId: 1, createdAt: -1 });
sessionSchema.index({ userTrackingId: 1, createdAt: -1 });
sessionSchema.index({ userTrackingId: 1, sessionId: 1 });

export type SessionDocument = InferSchemaType<typeof sessionSchema> & {
  _id: Types.ObjectId;
};

export const SessionModel = model("Session", sessionSchema);
