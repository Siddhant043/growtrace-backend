import { LinkModel, type LinkPlatform } from "../api/models/link.model";
import { ClickEventModel } from "../api/models/clickEvent.model";
import { generateShortCode } from "../api/utils/generateShortCode";
import type { ListLinksRequestQuery } from "../api/validators/link.validator";
import { Types } from "mongoose";

type CreateLinkInput = {
  originalUrl: string;
  platform: LinkPlatform;
  postId?: string;
  campaign?: string;
};

export type LinkResult = {
  id: string;
  originalUrl: string;
  shortCode: string;
  shortUrl: string;
  platform: LinkPlatform;
  postId: string | null;
  campaign: string | null;
  createdAt: Date;
  clicks: number;
};

type UpdateLinkInput = Partial<CreateLinkInput>;
type ListLinksSortBy = ListLinksRequestQuery["sortBy"];

type ApiError = Error & { statusCode: number };

const createApiError = (message: string, statusCode: number): ApiError => {
  const apiError = new Error(message) as ApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

const ensureValidUrl = (urlString: string): string => {
  const normalizedUrl = urlString.trim();
  if (normalizedUrl.length === 0) {
    throw createApiError("originalUrl is required", 400);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw createApiError("originalUrl must be a valid URL", 400);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw createApiError("originalUrl must use http or https protocol", 400);
  }

  return parsedUrl.toString();
};

const generateUniqueShortCode = async (): Promise<string> => {
  const maximumAttempts = 6;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const candidateShortCode = generateShortCode();
    const existingLink = await LinkModel.findOne({ shortCode: candidateShortCode })
      .select("_id")
      .lean();

    if (!existingLink) {
      return candidateShortCode;
    }
  }

  throw createApiError("Unable to generate a unique short code", 500);
};

const mapLinkToResult = (linkDocument: {
  _id: { toString(): string };
  originalUrl: string;
  shortCode: string;
  platform: LinkPlatform;
  postId?: string | null;
  campaign?: string | null;
  createdAt: Date;
}): LinkResult => ({
  id: linkDocument._id.toString(),
  originalUrl: linkDocument.originalUrl,
  shortCode: linkDocument.shortCode,
  shortUrl: "",
  platform: linkDocument.platform,
  postId: linkDocument.postId ?? null,
  campaign: linkDocument.campaign ?? null,
  createdAt: linkDocument.createdAt,
  clicks: 0,
});

const withShortUrl = (linkResult: LinkResult, apiBaseUrl: string): LinkResult => {
  const normalizedApiBaseUrl = apiBaseUrl.replace(/\/$/, "");
  return {
    ...linkResult,
    shortUrl: `${normalizedApiBaseUrl}/r/${linkResult.shortCode}`,
  };
};

const escapeForRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const createLink = async (
  data: CreateLinkInput,
  userId: string,
  apiBaseUrl: string,
): Promise<LinkResult> => {
  const validatedOriginalUrl = ensureValidUrl(data.originalUrl);
  const shortCode = await generateUniqueShortCode();

  const createdLink = await LinkModel.create({
    userId,
    originalUrl: validatedOriginalUrl,
    shortCode,
    platform: data.platform,
    postId: data.postId?.trim() || null,
    campaign: data.campaign?.trim() || null,
  });

  return withShortUrl(mapLinkToResult(createdLink), apiBaseUrl);
};

export const getLinkByShortCode = async (
  shortCode: string,
  userId: string,
  apiBaseUrl: string,
): Promise<LinkResult> => {
  const linkDocument = await LinkModel.findOne({ shortCode: shortCode.trim(), userId }).lean();

  if (!linkDocument) {
    throw createApiError("Link not found", 404);
  }

  return withShortUrl(mapLinkToResult(linkDocument), apiBaseUrl);
};

export const updateLinkByShortCode = async (
  shortCode: string,
  userId: string,
  updatePayload: UpdateLinkInput,
  apiBaseUrl: string,
): Promise<LinkResult> => {
  const updateOperations: {
    originalUrl?: string;
    platform?: LinkPlatform;
    postId?: string | null;
    campaign?: string | null;
  } = {};

  if (updatePayload.originalUrl !== undefined) {
    updateOperations.originalUrl = ensureValidUrl(updatePayload.originalUrl);
  }

  if (updatePayload.platform !== undefined) {
    updateOperations.platform = updatePayload.platform;
  }

  if (updatePayload.postId !== undefined) {
    updateOperations.postId = updatePayload.postId.trim() || null;
  }

  if (updatePayload.campaign !== undefined) {
    updateOperations.campaign = updatePayload.campaign.trim() || null;
  }

  const updatedLink = await LinkModel.findOneAndUpdate(
    { shortCode: shortCode.trim(), userId },
    { $set: updateOperations },
    { new: true },
  ).lean();

  if (!updatedLink) {
    throw createApiError("Link not found", 404);
  }

  return withShortUrl(mapLinkToResult(updatedLink), apiBaseUrl);
};

export const deleteLinkByShortCode = async (
  shortCode: string,
  userId: string,
): Promise<void> => {
  const deleteResult = await LinkModel.deleteOne({
    shortCode: shortCode.trim(),
    userId,
  });

  if (!deleteResult.deletedCount) {
    throw createApiError("Link not found", 404);
  }
};

export type ListLinksResult = {
  items: LinkResult[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export const listLinksForUser = async (
  userId: string,
  query: ListLinksRequestQuery,
  apiBaseUrl: string,
): Promise<ListLinksResult> => {
  const page = query.page;
  const pageSize = query.pageSize;

  const mongoFilter: {
    userId: string;
    platform?: LinkPlatform;
    $or?: Array<Record<string, unknown>>;
  } = {
    userId,
  };

  if (query.platform) {
    mongoFilter.platform = query.platform;
  }

  if (query.search && query.search.length > 0) {
    const escapedSearchTerm = escapeForRegex(query.search);
    const searchPattern = new RegExp(escapedSearchTerm, "i");
    mongoFilter.$or = [
      { shortCode: searchPattern },
      { originalUrl: searchPattern },
      { campaign: searchPattern },
      { postId: searchPattern },
      { platform: searchPattern },
    ];
  }

  const sortFieldByQuery: Record<ListLinksSortBy, string> = {
    createdAt: "createdAt",
    shortCode: "shortCode",
    platform: "platform",
  };
  const sortDirection = query.sortOrder === "asc" ? 1 : -1;
  const sortField = sortFieldByQuery[query.sortBy];

  const [totalItems, links] = await Promise.all([
    LinkModel.countDocuments(mongoFilter),
    LinkModel.find(mongoFilter)
      .sort({ [sortField]: sortDirection, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  const linkIds = links.map((linkRecord) => linkRecord._id);
  const clickCountsByLinkId = new Map<string, number>();
  if (linkIds.length > 0) {
    const userObjectId = new Types.ObjectId(userId);

    const clickCountAggregation = await ClickEventModel.aggregate<{
      linkId: string;
      clicks: number;
    }>([
      { $match: { userId: userObjectId, linkId: { $in: linkIds } } },
      { $group: { _id: "$linkId", clicks: { $sum: 1 } } },
      { $project: { _id: 0, linkId: { $toString: "$_id" }, clicks: 1 } },
    ]);

    clickCountAggregation.forEach((clickCountRecord) => {
      clickCountsByLinkId.set(clickCountRecord.linkId, clickCountRecord.clicks);
    });
  }

  return {
    items: links.map((linkRecord) => {
      const mappedLinkResult = mapLinkToResult(linkRecord);
      return {
        ...withShortUrl(mappedLinkResult, apiBaseUrl),
        clicks: clickCountsByLinkId.get(linkRecord._id.toString()) ?? 0,
      };
    }),
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };
};
