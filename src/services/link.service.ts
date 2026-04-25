import { LinkModel, type LinkPlatform } from "../api/models/link.model";
import { generateShortCode } from "../api/utils/generateShortCode";

type CreateLinkInput = {
  originalUrl: string;
  platform: LinkPlatform;
  postId?: string;
  campaign?: string;
};

type CreateLinkResult = {
  id: string;
  originalUrl: string;
  shortCode: string;
  shortUrl: string;
  platform: LinkPlatform;
  postId: string | null;
  campaign: string | null;
  createdAt: Date;
};

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

export const createLink = async (
  data: CreateLinkInput,
  userId: string,
  apiBaseUrl: string,
): Promise<CreateLinkResult> => {
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

  const normalizedApiBaseUrl = apiBaseUrl.replace(/\/$/, "");
  const shortUrl = `${normalizedApiBaseUrl}/r/${shortCode}`;

  return {
    id: createdLink._id.toString(),
    originalUrl: createdLink.originalUrl,
    shortCode: createdLink.shortCode,
    shortUrl,
    platform: createdLink.platform,
    postId: createdLink.postId ?? null,
    campaign: createdLink.campaign ?? null,
    createdAt: createdLink.createdAt,
  };
};
