import { CohortMetricsDailyModel } from "../api/models/cohortMetricsDaily.model.js";
import { UsersAggregatedModel } from "../api/models/usersAggregated.model.js";
import {
  HIGH_ENGAGEMENT_SCORE_MIN,
  LOW_ENGAGEMENT_SCORE_MAX,
} from "../utils/audienceSegmentation.utils.js";

type ServiceApiError = Error & { statusCode: number };

const createServiceApiError = (
  message: string,
  statusCode: number,
): ServiceApiError => {
  const apiError = new Error(message) as ServiceApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

const resolveDateRange = (parameters: {
  startDate?: string;
  endDate?: string;
}): { startDate: string; endDate: string } => {
  if (!parameters.startDate && !parameters.endDate) {
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 29);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: now.toISOString().slice(0, 10),
    };
  }

  if (!parameters.startDate || !parameters.endDate) {
    throw createServiceApiError(
      "Both startDate and endDate are required together",
      400,
    );
  }

  if (parameters.startDate > parameters.endDate) {
    throw createServiceApiError("startDate cannot be later than endDate", 400);
  }

  return {
    startDate: parameters.startDate,
    endDate: parameters.endDate,
  };
};

type CountFacetResult = {
  total?: Array<{ count: number }>;
  highEngagement?: Array<{ count: number }>;
  mediumEngagement?: Array<{ count: number }>;
  lowEngagement?: Array<{ count: number }>;
  returningUsers?: Array<{ count: number }>;
};

export const getAdminAudienceSegments = async () => {
  const [result] = (await UsersAggregatedModel.aggregate([
    {
      $facet: {
        total: [{ $count: "count" }],
        highEngagement: [
          { $match: { engagementScore: { $gte: HIGH_ENGAGEMENT_SCORE_MIN } } },
          { $count: "count" },
        ],
        mediumEngagement: [
          {
            $match: {
              engagementScore: {
                $gt: LOW_ENGAGEMENT_SCORE_MAX,
                $lt: HIGH_ENGAGEMENT_SCORE_MIN,
              },
            },
          },
          { $count: "count" },
        ],
        lowEngagement: [
          { $match: { engagementScore: { $lte: LOW_ENGAGEMENT_SCORE_MAX } } },
          { $count: "count" },
        ],
        returningUsers: [{ $match: { totalSessions: { $gt: 1 } } }, { $count: "count" }],
      },
    },
  ])) as CountFacetResult[];

  const total = result?.total?.[0]?.count ?? 0;
  const highEngagement = result?.highEngagement?.[0]?.count ?? 0;
  const mediumEngagement = result?.mediumEngagement?.[0]?.count ?? 0;
  const lowEngagement = result?.lowEngagement?.[0]?.count ?? 0;
  const returningUsers = result?.returningUsers?.[0]?.count ?? 0;

  return {
    highEngagement,
    mediumEngagement,
    lowEngagement,
    returningUsers,
    totalUsers: total,
    returningRate: total > 0 ? returningUsers / total : 0,
    thresholds: {
      highEngagementScoreMin: HIGH_ENGAGEMENT_SCORE_MIN,
      lowEngagementScoreMax: LOW_ENGAGEMENT_SCORE_MAX,
    },
  };
};

export const getAdminAudienceCohorts = async (parameters: {
  startDate?: string;
  endDate?: string;
  platform?: string;
  page: number;
  limit: number;
}) => {
  const dateRange = resolveDateRange({
    startDate: parameters.startDate,
    endDate: parameters.endDate,
  });
  const skip = (parameters.page - 1) * parameters.limit;

  const query: {
    cohortDate: { $gte: string; $lte: string };
    primaryPlatform?: string;
  } = {
    cohortDate: { $gte: dateRange.startDate, $lte: dateRange.endDate },
  };

  if (parameters.platform) {
    query.primaryPlatform = parameters.platform;
  }

  const [rows, total] = await Promise.all([
    CohortMetricsDailyModel.find(query)
      .sort({ cohortDate: -1, primaryPlatform: 1 })
      .skip(skip)
      .limit(parameters.limit)
      .lean(),
    CohortMetricsDailyModel.countDocuments(query),
  ]);

  return {
    rows: rows.map((row) => ({
      cohortDate: row.cohortDate,
      platform: row.primaryPlatform,
      users: row.users ?? 0,
      returningUsers: row.returningUsers ?? 0,
      returningRate: row.users > 0 ? row.returningUsers / row.users : 0,
      avgEngagement: row.avgEngagement ?? 0,
    })),
    pagination: {
      total,
      page: parameters.page,
      limit: parameters.limit,
      totalPages: Math.ceil(total / parameters.limit),
    },
    dateRange,
  };
};
