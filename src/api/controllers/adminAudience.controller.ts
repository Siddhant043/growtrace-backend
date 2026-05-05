import type { Request, Response } from "express";

import {
  getAdminAudienceCohorts,
  getAdminAudienceSegments,
} from "../../services/adminAudience.service.js";
import type { GetAdminAudienceCohortsRequestQuery } from "../validators/adminAudience.validator.js";

export const getAdminAudienceSegmentsController = async (
  _request: Request,
  response: Response,
): Promise<void> => {
  const data = await getAdminAudienceSegments();
  response.status(200).json(data);
};

export const getAdminAudienceCohortsController = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = request.query as unknown as GetAdminAudienceCohortsRequestQuery;
  const data = await getAdminAudienceCohorts({
    startDate: query.startDate,
    endDate: query.endDate,
    platform: query.platform,
    page: query.page ?? 1,
    limit: query.limit ?? 20,
  });
  response.status(200).json(data);
};
