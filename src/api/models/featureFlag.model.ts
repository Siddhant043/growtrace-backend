import { model, Schema, type InferSchemaType, type Types } from "mongoose";

const featureFlagSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "feature_flags",
  },
);

featureFlagSchema.index({ updatedAt: -1 });

export type FeatureFlagDocument = InferSchemaType<typeof featureFlagSchema> & {
  _id: Types.ObjectId;
};

export const FeatureFlagModel = model("FeatureFlag", featureFlagSchema);
