import type { Request, Response } from "express";

import {
  getAdminSupportEventDetails,
  getAdminUserActivity,
  listAdminSupportEvents,
} from "../../services/adminSupport.service.js";
import type {
  GetAdminSupportEventDetailsRequestParams,
  GetAdminUserActivityRequestParams,
  GetAdminUserActivityRequestQuery,
  ListAdminSupportEventsRequestQuery,
} from "../validators/adminSupport.validator.js";

export const getAdminUserActivityController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as GetAdminUserActivityRequestParams;
  const query = request.query as unknown as GetAdminUserActivityRequestQuery;

  const data = await getAdminUserActivity({
    userTrackingId: params.userTrackingId,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
    startDate: query.startDate,
    endDate: query.endDate,
    maxEventsPerSession: query.maxEventsPerSession ?? 100,
  });

  response.status(200).json(data);
};

export const listAdminSupportEventsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = request.query as unknown as ListAdminSupportEventsRequestQuery;
  const data = await listAdminSupportEvents({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    userTrackingId: query.userTrackingId,
    sessionId: query.sessionId,
    eventType: query.eventType,
    startDate: query.startDate,
    endDate: query.endDate,
  });
  response.status(200).json(data);
};

export const getAdminSupportEventDetailsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as GetAdminSupportEventDetailsRequestParams;
  const data = await getAdminSupportEventDetails(params.id);
  response.status(200).json(data);
};
