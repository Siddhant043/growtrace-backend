import { Types } from "mongoose";

import { LinkModel } from "../api/models/link.model.js";

type ApiError = Error & { statusCode: number };

const createApiError = (message: string, statusCode: number): ApiError => {
  const apiError = new Error(message) as ApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

export const resolveOwnedLinkMongoId = async (
  userId: string,
  linkIdOrShortCode: string,
): Promise<string> => {
  const trimmedLinkIdOrShortCode = linkIdOrShortCode.trim();
  const userObjectId = new Types.ObjectId(userId);

  if (/^[a-f\d]{24}$/i.test(trimmedLinkIdOrShortCode)) {
    const linkByObjectId = await LinkModel.findOne({
      _id: new Types.ObjectId(trimmedLinkIdOrShortCode),
      userId: userObjectId,
    })
      .select({ _id: 1 })
      .lean();

    if (!linkByObjectId) {
      throw createApiError("Link not found", 404);
    }

    return linkByObjectId._id.toString();
  }

  const linkByShortCode = await LinkModel.findOne({
    shortCode: trimmedLinkIdOrShortCode,
    userId: userObjectId,
  })
    .select({ _id: 1 })
    .lean();

  if (!linkByShortCode) {
    throw createApiError("Link not found", 404);
  }

  return linkByShortCode._id.toString();
};
