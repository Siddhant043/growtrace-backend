import { model, Schema, type InferSchemaType, type Types } from "mongoose";

import { LINK_PLATFORMS } from "./link.model";

export const DEVICE_TYPES = ["mobile", "desktop", "tablet"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

const clickEventSchema = new Schema(
  {
    linkId: {
      type: Schema.Types.ObjectId,
      ref: "Link",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: LINK_PLATFORMS,
      default: "other",
    },
    postId: {
      type: String,
      trim: true,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
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
    referrer: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    versionKey: false,
  },
);

clickEventSchema.index({ linkId: 1, timestamp: -1 });
clickEventSchema.index({ userId: 1, timestamp: -1 });
clickEventSchema.index({ platform: 1 });

export type ClickEventDocument = InferSchemaType<typeof clickEventSchema> & {
  _id: Types.ObjectId;
};

export const ClickEventModel = model("ClickEvent", clickEventSchema);
