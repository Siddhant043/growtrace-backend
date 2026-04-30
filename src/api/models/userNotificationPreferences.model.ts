import { model, Schema, type InferSchemaType, type Types } from "mongoose";

import { ALERT_TYPES, type AlertType } from "./alert.model";

const alertTypePreferenceSchema = new Schema(
  {
    engagement_drop: { type: Boolean, default: true },
    traffic_spike: { type: Boolean, default: true },
    top_link: { type: Boolean, default: true },
  },
  { _id: false, versionKey: false },
);

const userNotificationPreferencesSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    emailEnabled: {
      type: Boolean,
      default: true,
    },
    inAppEnabled: {
      type: Boolean,
      default: true,
    },
    types: {
      type: alertTypePreferenceSchema,
      default: () => ({
        engagement_drop: true,
        traffic_spike: true,
        top_link: true,
      }),
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "user_notification_preferences",
  },
);

export type UserNotificationPreferencesDocument = InferSchemaType<
  typeof userNotificationPreferencesSchema
> & {
  _id: Types.ObjectId;
};

export const UserNotificationPreferencesModel = model(
  "UserNotificationPreferences",
  userNotificationPreferencesSchema,
);

export const buildDefaultAlertTypePreferences = (): Record<AlertType, boolean> =>
  ALERT_TYPES.reduce(
    (accumulator, alertType) => {
      accumulator[alertType] = true;
      return accumulator;
    },
    {} as Record<AlertType, boolean>,
  );
