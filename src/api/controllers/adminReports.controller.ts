import type { Request, Response } from "express";

import {
  getAdminReportDetails,
  listAdminReportHistory,
  listAdminReportJobs,
  listAdminReports,
  triggerAdminReportGeneration,
} from "../../services/adminReports.service.js";
import type {
  GetAdminReportDetailsRequestParams,
  ListAdminReportHistoryRequestParams,
  ListAdminReportHistoryRequestQuery,
  ListAdminReportJobsRequestQuery,
  ListAdminReportsRequestQuery,
  TriggerAdminReportGenerationRequestParams,
} from "../validators/adminReports.validator.js";

export const listAdminReportsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = request.query as unknown as ListAdminReportsRequestQuery;
  const data = await listAdminReports({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    userId: query.userId,
    status: query.status,
  });
  response.status(200).json(data);
};

export const getAdminReportDetailsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as GetAdminReportDetailsRequestParams;
  const report = await getAdminReportDetails(params.id);
  if (!report) {
    response.status(404).json({ message: "Report not found" });
    return;
  }
  response.status(200).json(report);
};

export const listAdminReportHistoryController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as ListAdminReportHistoryRequestParams;
  const query = request.query as unknown as ListAdminReportHistoryRequestQuery;
  const data = await listAdminReportHistory({
    userId: params.userId,
    page: query.page ?? 1,
    limit: query.limit ?? 20,
  });
  response.status(200).json(data);
};

export const triggerAdminReportGenerationController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as TriggerAdminReportGenerationRequestParams;
  const data = await triggerAdminReportGeneration({ userId: params.userId });
  response.status(202).json(data);
};

export const listAdminReportJobsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = request.query as unknown as ListAdminReportJobsRequestQuery;
  const data = await listAdminReportJobs({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    userId: query.userId,
    status: query.status,
  });
  response.status(200).json(data);
};
