import { model, Schema, type InferSchemaType, type Types } from "mongoose";

const emailTemplateSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100_000,
    },
    variables: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "email_templates",
  },
);

emailTemplateSchema.index({ updatedAt: -1 });

export type EmailTemplateDocument = InferSchemaType<typeof emailTemplateSchema> & {
  _id: Types.ObjectId;
};

export const EmailTemplateModel = model("EmailTemplate", emailTemplateSchema);
