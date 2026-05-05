import { model, Schema, type InferSchemaType, type Types } from "mongoose";

import { ALERT_TYPES } from "./alert.model.js";

const alertRuleSchema = new Schema(
  {
    type: {
      type: String,
      enum: ALERT_TYPES,
      required: true,
      unique: true,
      trim: true,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    thresholds: {
      dropPercent: { type: Number, default: null, min: 0 },
      spikeMultiplier: { type: Number, default: null, min: 1 },
    },
    cooldownHours: {
      type: Number,
      required: true,
      default: 6,
      min: 1,
      max: 168,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "alert_rules",
  },
);

alertRuleSchema.index({ updatedAt: -1 });

export type AlertRuleDocument = InferSchemaType<typeof alertRuleSchema> & {
  _id: Types.ObjectId;
};

export const AlertRuleModel = model("AlertRule", alertRuleSchema);

