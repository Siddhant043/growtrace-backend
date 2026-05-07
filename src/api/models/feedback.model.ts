import { model, Schema, type InferSchemaType, type Types } from "mongoose";

export const FEEDBACK_CATEGORIES = ["feature_request"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_STATUSES = ["received"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

const feedbackSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 3000,
    },
    category: {
      type: String,
      enum: FEEDBACK_CATEGORIES,
      default: "feature_request",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: FEEDBACK_STATUSES,
      default: "received",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "feedback",
  },
);

feedbackSchema.index({ createdAt: -1 }, { name: "feedback_created_at_desc_idx" });

export type FeedbackDocument = InferSchemaType<typeof feedbackSchema> & {
  _id: Types.ObjectId;
};

export const FeedbackModel = model("Feedback", feedbackSchema);
