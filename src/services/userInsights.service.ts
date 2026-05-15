import {
  getInsightDetails,
  listAdminInsights,
} from "./adminInsights.service.js";
import type { InsightType } from "../api/models/insightRead.model.js";

type ServiceApiError = Error & { statusCode: number };

const createServiceApiError = (
  message: string,
  statusCode: number,
): ServiceApiError => {
  const apiError = new Error(message) as ServiceApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

export interface ListInsightsForCurrentUserInput {
  userId: string;
  page: number;
  limit: number;
  type?: InsightType;
  startDate?: string;
  endDate?: string;
  sortBy?: "createdAt" | "confidence" | "type";
  sortOrder?: "asc" | "desc";
}

export const listInsightsForCurrentUser = async (
  input: ListInsightsForCurrentUserInput,
) => {
  return listAdminInsights({
    page: input.page,
    limit: input.limit,
    type: input.type,
    userId: input.userId,
    startDate: input.startDate,
    endDate: input.endDate,
    sortBy: input.sortBy,
    sortOrder: input.sortOrder,
  });
};

export const getInsightDetailsForCurrentUser = async (
  insightId: string,
  requesterUserId: string,
) => {
  const insight = await getInsightDetails(insightId);
  if (insight.userId !== requesterUserId) {
    throw createServiceApiError("Insight not found", 404);
  }
  return insight;
};
