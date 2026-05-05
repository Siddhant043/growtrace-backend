import type { Request, Response } from "express";

import {
  getInsightDetails,
  listAdminInsights,
  listFailedInsightJobs,
  retryInsightJob,
} from "../../services/adminInsights.service.js";
import type {
  ListAdminInsightsRequestQuery,
  ListFailedAdminInsightsRequestQuery,
  RetryAdminInsightJobRequestParams,
} from "../validators/adminInsights.validator.js";

export const listAdminInsightsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = request.query as unknown as ListAdminInsightsRequestQuery;
  const insightsResponse = await listAdminInsights({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    type: query.type,
    userId: query.userId,
    startDate: query.startDate,
    endDate: query.endDate,
  });

  response.status(200).json(insightsResponse);
};

export const listFailedAdminInsightsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = request.query as unknown as ListFailedAdminInsightsRequestQuery;
  const failedJobsResponse = await listFailedInsightJobs({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
  });

  response.status(200).json(failedJobsResponse);
};

export const retryAdminInsightJobController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as RetryAdminInsightJobRequestParams;
  const retryResponse = await retryInsightJob(params.jobId);
  response.status(200).json(retryResponse);
};

export const getAdminInsightDetailsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as { insightId: string };
  const insightDetails = await getInsightDetails(params.insightId);
  response.status(200).json(insightDetails);
};

