import type { Request, Response } from "express";

import {
  getAdminSubscriptionDetails,
  listAdminPayments,
  listAdminSubscriptions,
  listFailedAdminPayments,
} from "../../services/adminBilling.service.js";
import type {
  GetAdminSubscriptionDetailsRequestParams,
  ListAdminPaymentsRequestQuery,
  ListAdminSubscriptionsRequestQuery,
} from "../validators/adminBilling.validator.js";

type ApiError = Error & { statusCode: number };

const createApiError = (message: string, statusCode: number): ApiError => {
  const apiError = new Error(message) as ApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

export const listAdminSubscriptionsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = (request.query ?? {}) as unknown as ListAdminSubscriptionsRequestQuery;
  const parsedPageValue =
    typeof query?.page === "number"
      ? query.page
      : Number.parseInt(String(query?.page ?? "1"), 10);
  const parsedLimitValue =
    typeof query?.limit === "number"
      ? query.limit
      : Number.parseInt(String(query?.limit ?? "20"), 10);
  const page = Number.isNaN(parsedPageValue) ? 1 : parsedPageValue;
  const limit = Number.isNaN(parsedLimitValue) ? 20 : parsedLimitValue;
  try {
    const subscriptions = await listAdminSubscriptions({
      page,
      limit,
      status: query?.status,
      search: query?.search,
    });
    response.status(200).json(subscriptions);
  } catch (error) {
    throw error;
  }
};

export const getAdminSubscriptionDetailsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params =
    request.params as unknown as GetAdminSubscriptionDetailsRequestParams;
  const subscriptionDetails = await getAdminSubscriptionDetails(
    params.subscriptionId,
  );
  if (!subscriptionDetails) {
    throw createApiError("Subscription not found", 404);
  }
  response.status(200).json(subscriptionDetails);
};

export const listAdminPaymentsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = (request.query ?? {}) as unknown as ListAdminPaymentsRequestQuery;
  const payments = await listAdminPayments({
    page: query?.page ?? 1,
    limit: query?.limit ?? 20,
    status: query?.status,
    userId: query?.userId,
    fromDate: query?.fromDate,
    toDate: query?.toDate,
  });
  response.status(200).json(payments);
};

export const listFailedAdminPaymentsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = (request.query ?? {}) as unknown as ListAdminPaymentsRequestQuery;
  const failedPayments = await listFailedAdminPayments({
    page: query?.page ?? 1,
    limit: query?.limit ?? 20,
    userId: query?.userId,
    fromDate: query?.fromDate,
    toDate: query?.toDate,
  });
  response.status(200).json(failedPayments);
};

