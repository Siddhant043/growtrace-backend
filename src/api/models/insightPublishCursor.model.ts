import { model, Schema, type InferSchemaType, type Types } from "mongoose";

const insightPublishCursorSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    lastPublishedAt: {
      type: Date,
      required: true,
    },
    lastPublishedContentHash: {
      type: String,
      required: true,
      trim: true,
    },
    lastTotalLinkClicks: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    versionKey: false,
    timestamps: true,
    collection: "insight_publish_cursors",
  },
);

export type InsightPublishCursorDocument =
  InferSchemaType<typeof insightPublishCursorSchema> & {
    _id: Types.ObjectId;
  };

export const InsightPublishCursorModel = model(
  "InsightPublishCursor",
  insightPublishCursorSchema,
);
