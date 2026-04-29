import { Types } from "mongoose";

import { connectToRedis } from "../../infrastructure/redis";
import { LinkModel, type LinkPlatform } from "../models/link.model";

const LINK_METADATA_CACHE_PREFIX = "link:meta:";
const LINK_METADATA_CACHE_TTL_SECONDS = 5 * 60;
const LINK_METADATA_MISSING_MARKER = "__missing__";

export type LinkMetadataSummary = {
  platform: LinkPlatform | null;
  campaign: string | null;
};

const buildEmptyLinkMetadata = (): LinkMetadataSummary => ({
  platform: null,
  campaign: null,
});

const buildCacheKey = (linkId: string): string =>
  `${LINK_METADATA_CACHE_PREFIX}${linkId}`;

const tryReadCachedLinkMetadata = async (
  linkId: string,
): Promise<LinkMetadataSummary | null> => {
  const redisClient = await connectToRedis();
  const cachedValue = await redisClient.get(buildCacheKey(linkId));

  if (cachedValue === null) {
    return null;
  }

  if (cachedValue === LINK_METADATA_MISSING_MARKER) {
    return buildEmptyLinkMetadata();
  }

  try {
    return JSON.parse(cachedValue) as LinkMetadataSummary;
  } catch {
    return null;
  }
};

const writeCachedLinkMetadata = async (
  linkId: string,
  metadataSummary: LinkMetadataSummary,
): Promise<void> => {
  const redisClient = await connectToRedis();

  await redisClient.set(
    buildCacheKey(linkId),
    JSON.stringify(metadataSummary),
    "EX",
    LINK_METADATA_CACHE_TTL_SECONDS,
  );
};

const writeCachedLinkMetadataMissing = async (linkId: string): Promise<void> => {
  const redisClient = await connectToRedis();

  await redisClient.set(
    buildCacheKey(linkId),
    LINK_METADATA_MISSING_MARKER,
    "EX",
    LINK_METADATA_CACHE_TTL_SECONDS,
  );
};

export const getLinkMetadataSummary = async (
  linkId: string | null,
): Promise<LinkMetadataSummary> => {
  if (!linkId || !Types.ObjectId.isValid(linkId)) {
    return buildEmptyLinkMetadata();
  }

  const cachedMetadata = await tryReadCachedLinkMetadata(linkId);
  if (cachedMetadata) {
    return cachedMetadata;
  }

  const linkDocument = await LinkModel.findById(linkId)
    .select("platform campaign")
    .lean();

  if (!linkDocument) {
    await writeCachedLinkMetadataMissing(linkId);
    return buildEmptyLinkMetadata();
  }

  const metadataSummary: LinkMetadataSummary = {
    platform: (linkDocument.platform as LinkPlatform | undefined) ?? null,
    campaign: linkDocument.campaign ?? null,
  };

  await writeCachedLinkMetadata(linkId, metadataSummary);
  return metadataSummary;
};
