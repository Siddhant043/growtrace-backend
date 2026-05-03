import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/authenticate.js";
import type {
  CreateLinkRequestBody,
  ListLinksRequestQuery,
  LinkByShortCodeParams,
  UpdateLinkRequestBody,
} from "../validators/link.validator.js";
import {
  createLink,
  deleteLinkByShortCode,
  getLinkByShortCode,
  listLinksForUser,
  updateLinkByShortCode,
} from "../../services/link.service.js";

export const listLinks = async (request: Request, response: Response): Promise<void> => {
  const authenticatedRequest = request as AuthenticatedRequest & {
    query: ListLinksRequestQuery;
  };

  const paginatedLinks = await listLinksForUser(
    authenticatedRequest.authenticatedUser.id,
    authenticatedRequest.query,
    `${request.protocol}://${request.get("host") ?? "localhost"}`,
  );

  response.status(200).json({
    success: true,
    data: paginatedLinks,
  });
};

export const createShortLink = async (
  request: Request<unknown, unknown, CreateLinkRequestBody>,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = request as AuthenticatedRequest &
    Request<unknown, unknown, CreateLinkRequestBody>;

  const createdLink = await createLink(
    request.body,
    authenticatedRequest.authenticatedUser.id,
    `${request.protocol}://${request.get("host") ?? "localhost"}`,
  );

  response.status(201).json({
    success: true,
    data: createdLink,
  });
};

export const getLinkDetails = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = request as AuthenticatedRequest & {
    params: LinkByShortCodeParams;
  };
  const shortCode = String(authenticatedRequest.params.shortCode);

  const linkRecord = await getLinkByShortCode(
    shortCode,
    authenticatedRequest.authenticatedUser.id,
    `${request.protocol}://${request.get("host") ?? "localhost"}`,
  );

  response.status(200).json({
    success: true,
    data: linkRecord,
  });
};

export const updateLinkDetails = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = request as AuthenticatedRequest & {
    params: LinkByShortCodeParams;
    body: UpdateLinkRequestBody;
  };
  const shortCode = String(authenticatedRequest.params.shortCode);

  const updatedLinkRecord = await updateLinkByShortCode(
    shortCode,
    authenticatedRequest.authenticatedUser.id,
    authenticatedRequest.body,
    `${request.protocol}://${request.get("host") ?? "localhost"}`,
  );

  response.status(200).json({
    success: true,
    data: updatedLinkRecord,
  });
};

export const deleteLink = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = request as AuthenticatedRequest & {
    params: LinkByShortCodeParams;
  };
  const shortCode = String(authenticatedRequest.params.shortCode);

  await deleteLinkByShortCode(shortCode, authenticatedRequest.authenticatedUser.id);

  response.status(200).json({
    success: true,
    data: {
      shortCode,
    },
  });
};
