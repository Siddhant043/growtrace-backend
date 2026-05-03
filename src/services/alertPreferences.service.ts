import { Types } from "mongoose";

import {
  ALERT_TYPES,
  type AlertChannel,
  type AlertType,
} from "../api/models/alert.model.js";
import {
  UserNotificationPreferencesModel,
  type UserNotificationPreferencesDocument,
} from "../api/models/userNotificationPreferences.model.js";

export interface AlertTypePreferenceMap {
  engagement_drop: boolean;
  traffic_spike: boolean;
  top_link: boolean;
}

export interface NormalizedNotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  types: AlertTypePreferenceMap;
}

const buildDefaultPreferences = (
  userId: string,
): NormalizedNotificationPreferences => ({
  userId,
  emailEnabled: true,
  inAppEnabled: true,
  types: {
    engagement_drop: true,
    traffic_spike: true,
    top_link: true,
  },
});

const toNormalizedPreferences = (
  document: UserNotificationPreferencesDocument,
): NormalizedNotificationPreferences => ({
  userId: document.userId.toString(),
  emailEnabled: document.emailEnabled,
  inAppEnabled: document.inAppEnabled,
  types: {
    engagement_drop: document.types?.engagement_drop ?? true,
    traffic_spike: document.types?.traffic_spike ?? true,
    top_link: document.types?.top_link ?? true,
  },
});

export const getNotificationPreferencesForUser = async (
  userId: string,
): Promise<NormalizedNotificationPreferences> => {
  if (!Types.ObjectId.isValid(userId)) {
    return buildDefaultPreferences(userId);
  }

  const existingDocument = await UserNotificationPreferencesModel.findOne({
    userId: new Types.ObjectId(userId),
  }).lean<UserNotificationPreferencesDocument | null>();

  if (!existingDocument) {
    return buildDefaultPreferences(userId);
  }

  return toNormalizedPreferences(existingDocument);
};

export interface UpdateNotificationPreferencesInput {
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
  types?: Partial<AlertTypePreferenceMap>;
}

export const upsertNotificationPreferencesForUser = async (
  userId: string,
  updateInput: UpdateNotificationPreferencesInput,
): Promise<NormalizedNotificationPreferences> => {
  if (!Types.ObjectId.isValid(userId)) {
    throw new Error(
      `alertPreferences.service: invalid userId "${userId}"`,
    );
  }

  const currentPreferences = await getNotificationPreferencesForUser(userId);

  const mergedTypes: AlertTypePreferenceMap = {
    engagement_drop:
      updateInput.types?.engagement_drop ?? currentPreferences.types.engagement_drop,
    traffic_spike:
      updateInput.types?.traffic_spike ?? currentPreferences.types.traffic_spike,
    top_link:
      updateInput.types?.top_link ?? currentPreferences.types.top_link,
  };

  const mergedPreferences: NormalizedNotificationPreferences = {
    userId,
    emailEnabled: updateInput.emailEnabled ?? currentPreferences.emailEnabled,
    inAppEnabled: updateInput.inAppEnabled ?? currentPreferences.inAppEnabled,
    types: mergedTypes,
  };

  await UserNotificationPreferencesModel.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    {
      $set: {
        emailEnabled: mergedPreferences.emailEnabled,
        inAppEnabled: mergedPreferences.inAppEnabled,
        types: mergedPreferences.types,
      },
      $setOnInsert: {
        userId: new Types.ObjectId(userId),
      },
    },
    { upsert: true, new: true },
  ).lean();

  return mergedPreferences;
};

export const isAlertTypeEnabledForChannel = (
  preferences: NormalizedNotificationPreferences,
  alertType: AlertType,
  channel: AlertChannel,
): boolean => {
  if (!preferences.types[alertType]) {
    return false;
  }
  if (channel === "email") {
    return preferences.emailEnabled;
  }
  return preferences.inAppEnabled;
};

export const resolveDispatchChannelsForAlert = (
  preferences: NormalizedNotificationPreferences,
  alertType: AlertType,
): AlertChannel[] => {
  const dispatchChannels: AlertChannel[] = [];

  if (isAlertTypeEnabledForChannel(preferences, alertType, "in-app")) {
    dispatchChannels.push("in-app");
  }
  if (isAlertTypeEnabledForChannel(preferences, alertType, "email")) {
    dispatchChannels.push("email");
  }

  return dispatchChannels;
};

export const buildAllAlertTypesEnabledMap = (): AlertTypePreferenceMap =>
  ALERT_TYPES.reduce(
    (accumulator, alertType) => {
      accumulator[alertType] = true;
      return accumulator;
    },
    { engagement_drop: true, traffic_spike: true, top_link: true } as AlertTypePreferenceMap,
  );
