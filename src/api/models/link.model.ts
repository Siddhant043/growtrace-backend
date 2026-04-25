import { model, Schema, type InferSchemaType, type Types } from "mongoose";

export const LINK_PLATFORMS = [
  "instagram",
  "youtube",
  "twitter",
  "linkedin",
  "facebook",
  "tiktok",
  "threads",
  "whatsapp",
  "telegram",
  "discord",
  "reddit",
  "snapchat",
  "pinterest",
  "other",
] as const;

export type LinkPlatform = (typeof LINK_PLATFORMS)[number];

const linkSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    originalUrl: {
      type: String,
      required: true,
      trim: true,
    },
    shortCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    platform: {
      type: String,
      required: true,
      enum: LINK_PLATFORMS,
    },
    postId: {
      type: String,
      trim: true,
      default: null,
    },
    campaign: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

linkSchema.index({ userId: 1, createdAt: -1 });
linkSchema.index({ userId: 1, platform: 1 });

export type LinkDocument = InferSchemaType<typeof linkSchema> & {
  _id: Types.ObjectId;
};

export const LinkModel = model("Link", linkSchema);
