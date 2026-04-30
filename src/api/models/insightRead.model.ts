import { model, Schema, type InferSchemaType, type Types } from "mongoose";

export const INSIGHT_TYPES = [
  "platform",
  "content",
  "trend",
  "recommendation",
] as const;

export type InsightType = (typeof INSIGHT_TYPES)[number];

const insightReadSchema = new Schema(
  {
    userId: { type: String, required: true, trim: true },
    type: { type: String, enum: INSIGHT_TYPES, required: true },
    message: { type: String, required: true, trim: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    signature: { type: String, required: true, trim: true },
    metadata: { type: Schema.Types.Mixed, default: null },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  {
    versionKey: false,
    timestamps: { createdAt: false, updatedAt: true },
    collection: "insights",
  },
);

export type InsightReadDocument = InferSchemaType<typeof insightReadSchema> & {
  _id: Types.ObjectId;
};

export const InsightReadModel = model("InsightRead", insightReadSchema);
