import { FeatureFlagModel } from "../api/models/featureFlag.model.js";
import { NotificationSettingModel } from "../api/models/notificationSetting.model.js";

type CachedMapEntry = {
  enabled: boolean;
  channels?: string[];
};

const DEFAULT_REFRESH_INTERVAL_MS = 60_000;

const runtimeConfigCacheState: {
  featureFlagByKey: Map<string, CachedMapEntry>;
  notificationSettingByType: Map<string, CachedMapEntry>;
  isInitialized: boolean;
  refreshIntervalHandle: NodeJS.Timeout | null;
} = {
  featureFlagByKey: new Map(),
  notificationSettingByType: new Map(),
  isInitialized: false,
  refreshIntervalHandle: null,
};

const normalizeLookupKey = (value: string): string => value.trim().toLowerCase();

const refreshRuntimeConfigCache = async (): Promise<void> => {
  const [featureFlags, notificationSettings] = await Promise.all([
    FeatureFlagModel.find({}).lean(),
    NotificationSettingModel.find({}).lean(),
  ]);

  runtimeConfigCacheState.featureFlagByKey = new Map(
    featureFlags.map((featureFlag) => [
      normalizeLookupKey(featureFlag.key),
      { enabled: featureFlag.enabled },
    ]),
  );
  runtimeConfigCacheState.notificationSettingByType = new Map(
    notificationSettings.map((notificationSetting) => [
      normalizeLookupKey(notificationSetting.type),
      {
        enabled: notificationSetting.enabled,
        channels: notificationSetting.channels,
      },
    ]),
  );
  runtimeConfigCacheState.isInitialized = true;
};

export const initializeRuntimeConfigCache = async (
  refreshIntervalMs: number = DEFAULT_REFRESH_INTERVAL_MS,
): Promise<void> => {
  await refreshRuntimeConfigCache();

  if (!runtimeConfigCacheState.refreshIntervalHandle) {
    runtimeConfigCacheState.refreshIntervalHandle = setInterval(() => {
      void refreshRuntimeConfigCache();
    }, refreshIntervalMs);
  }
};

export const invalidateRuntimeConfigCache = async (): Promise<void> => {
  await refreshRuntimeConfigCache();
};

export const featureFlagEnabled = async (
  featureKey: string,
): Promise<boolean> => {
  if (!runtimeConfigCacheState.isInitialized) {
    await initializeRuntimeConfigCache();
  }
  const normalizedKey = normalizeLookupKey(featureKey);
  return runtimeConfigCacheState.featureFlagByKey.get(normalizedKey)?.enabled ?? false;
};

export const notificationEnabled = async (
  notificationType: string,
  channel?: string,
): Promise<boolean> => {
  if (!runtimeConfigCacheState.isInitialized) {
    await initializeRuntimeConfigCache();
  }
  const normalizedType = normalizeLookupKey(notificationType);
  const settingEntry =
    runtimeConfigCacheState.notificationSettingByType.get(normalizedType);

  if (!settingEntry?.enabled) {
    return false;
  }

  if (!channel) {
    return true;
  }

  return (settingEntry.channels ?? []).includes(channel);
};
