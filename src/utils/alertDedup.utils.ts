import { createHash } from "crypto";

import { env } from "../config/env.js";
import type { AlertType } from "../api/models/alert.model.js";

const MILLIS_PER_HOUR = 60 * 60 * 1000;

export interface BuildAlertDedupeKeyParameters {
  userId: string;
  type: AlertType;
  metadataKey: string;
  occurredAtMs?: number;
  bucketHours?: number;
}

/**
 * Computes a deterministic dedupe bucket index. Two alert events that fall
 * in the same `bucketHours`-wide rolling window collapse to the same key.
 */
const computeBucketIndex = (
  occurredAtMs: number,
  bucketHours: number,
): number => Math.floor(occurredAtMs / (bucketHours * MILLIS_PER_HOUR));

export const buildAlertDedupeKey = (
  parameters: BuildAlertDedupeKeyParameters,
): string => {
  const occurredAtMs = parameters.occurredAtMs ?? Date.now();
  const bucketHours =
    parameters.bucketHours ?? env.ALERTS_DEDUP_WINDOW_HOURS;
  const bucketIndex = computeBucketIndex(occurredAtMs, bucketHours);

  const fingerprintInput = [
    parameters.userId,
    parameters.type,
    parameters.metadataKey,
    String(bucketIndex),
  ].join("|");

  return createHash("sha256").update(fingerprintInput).digest("hex");
};

/**
 * Normalizes the metadata fragment used inside the dedupe key. Keys are sorted
 * to guarantee stable hashing regardless of caller insertion order.
 */
export const buildAlertMetadataKey = (
  metadata: Record<string, string | number | null | undefined>,
): string => {
  const sortedEntries = Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${String(value)}`);

  return sortedEntries.join(";");
};
