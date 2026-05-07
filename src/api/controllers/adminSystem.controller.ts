import type { Request, Response } from "express";

import {
  getAdminSystemErrorDetails,
  listAdminSystemErrors,
  listAdminSystemQueueStatus,
  listAdminSystemWorkerHealth,
} from "../../services/adminSystem.service.js";
import type {
  GetAdminSystemErrorDetailsRequestParams,
  ListAdminSystemErrorsRequestQuery,
} from "../validators/adminSystem.validator.js";

export const listAdminSystemQueuesController = async (
  _request: Request,
  response: Response,
): Promise<void> => {
  const queues = await listAdminSystemQueueStatus();
  response.status(200).json({ queues });
};

export const listAdminSystemWorkersController = async (
  _request: Request,
  response: Response,
): Promise<void> => {
  const workers = await listAdminSystemWorkerHealth();
  response.status(200).json({ workers });
};

export const listAdminSystemErrorsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = request.query as unknown as ListAdminSystemErrorsRequestQuery;
  const errors = await listAdminSystemErrors({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    severity: query.severity,
    source: query.source,
    startDate: query.startDate,
    endDate: query.endDate,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });
  response.status(200).json(errors);
};

export const getAdminSystemErrorDetailsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as GetAdminSystemErrorDetailsRequestParams;
  const errorDetails = await getAdminSystemErrorDetails(params.id);
  response.status(200).json(errorDetails);
};
