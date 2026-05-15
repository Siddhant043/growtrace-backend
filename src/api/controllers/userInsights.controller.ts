import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/authenticate.js";
import {
  getInsightDetailsForCurrentUser,
  listInsightsForCurrentUser,
} from "../../services/userInsights.service.js";
import type {
  GetUserInsightDetailsRequestParams,
  ListUserInsightsRequestQuery,
} from "../validators/userInsights.validator.js";

export const listUserInsightsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = request as AuthenticatedRequest;
  const query = request.query as unknown as ListUserInsightsRequestQuery;
  const insightsResponse = await listInsightsForCurrentUser({
    userId: authenticatedRequest.authenticatedUser.id,
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    type: query.type,
    startDate: query.startDate,
    endDate: query.endDate,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });

  const insights = insightsResponse.insights.map(
    ({ userId: _omitUserId, ...insightRow }) => insightRow,
  );

  response.status(200).json({
    insights,
    pagination: insightsResponse.pagination,
  });
};

export const getUserInsightDetailsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = request as AuthenticatedRequest;
  const params = request.params as GetUserInsightDetailsRequestParams;
  const insightDetails = await getInsightDetailsForCurrentUser(
    params.insightId,
    authenticatedRequest.authenticatedUser.id,
  );
  const { userId: _omitUserId, ...body } = insightDetails;
  response.status(200).json(body);
};
