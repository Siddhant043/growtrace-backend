import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/authenticate";
import type { CreateLinkRequestBody } from "../validators/link.validator";
import { createLink } from "../../services/link.service";

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
