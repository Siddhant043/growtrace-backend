import { model, Schema, type InferSchemaType, type Types } from "mongoose";

export const NOTIFICATION_SETTING_CHANNELS = ["email", "in-app"] as const;
export type NotificationSettingChannel =
  (typeof NOTIFICATION_SETTING_CHANNELS)[number];

const notificationSettingSchema = new Schema(
  {
    type: {
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
    channels: {
      type: [String],
      enum: NOTIFICATION_SETTING_CHANNELS,
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "notification_settings",
  },
);

notificationSettingSchema.index({ updatedAt: -1 });

export type NotificationSettingDocument = InferSchemaType<
  typeof notificationSettingSchema
> & {
  _id: Types.ObjectId;
};

export const NotificationSettingModel = model(
  "NotificationSetting",
  notificationSettingSchema,
);
