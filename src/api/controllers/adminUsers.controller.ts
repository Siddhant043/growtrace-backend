import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/authenticate.js";
import {
  getAdminUserDetail,
  listAdminUsers,
  updateAdminUserPlan,
  updateAdminUserStatus,
} from "../../services/adminUsers.service.js";
import type {
  ListAdminUsersRequestQuery,
  UpdateAdminUserPlanRequestBody,
  UpdateAdminUserStatusRequestBody,
} from "../validators/adminUsers.validator.js";

export const listAdminUsersController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = request.query as unknown as ListAdminUsersRequestQuery;
  const usersResponse = await listAdminUsers({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    search: query.search,
    status: query.status,
    plan: query.plan,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });

  response.status(200).json(usersResponse);
};

export const listSuspendedAdminUsersController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = request.query as unknown as ListAdminUsersRequestQuery;
  const usersResponse = await listAdminUsers({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    search: query.search,
    status: "suspended",
    plan: query.plan,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });

  response.status(200).json(usersResponse);
};

export const getAdminUserDetailController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as { userId: string };
  const userDetail = await getAdminUserDetail(params.userId);

  if (!userDetail) {
    response.status(404).json({
      success: false,
      message: "User not found",
    });
    return;
  }

  response.status(200).json(userDetail);
};

export const updateAdminUserStatusController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = request as unknown as AuthenticatedRequest;
  const params = request.params as { userId: string };
  const body = request.body as UpdateAdminUserStatusRequestBody;
  await updateAdminUserStatus(
    authenticatedRequest.authenticatedUser.id,
    params.userId,
    body.status,
  );

  response.status(200).json({
    success: true,
    message: "User status updated successfully",
  });
};

export const updateAdminUserPlanController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = request.params as { userId: string };
  const body = request.body as UpdateAdminUserPlanRequestBody;
  await updateAdminUserPlan(params.userId, body.plan);

  response.status(200).json({
    success: true,
    message: "User plan updated successfully",
  });
};

