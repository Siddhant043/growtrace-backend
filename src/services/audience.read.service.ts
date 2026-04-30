import { Types, type PipelineStage } from "mongoose";

import { UsersAggregatedModel } from "../api/models/usersAggregated.model";
import { CohortMetricsDailyModel } from "../api/models/cohortMetricsDaily.model";
import { InsightReadModel } from "../api/models/insightRead.model";
import {
  HIGH_ENGAGEMENT_SCORE_MIN,
  LOW_ENGAGEMENT_SCORE_MAX,
  classifyEngagementSegment,
  getAudienceEngagementThresholds,
  type AudienceSegmentLabel,
} from "../utils/audienceSegmentation.utils";

export interface AudienceSegmentCounts {
  total: number;
  highEngagement: number;
  lowEngagement: number;
  midEngagement: number;
  returningUsers: number;
}

export interface AudienceSegmentSummary extends AudienceSegmentCounts {
  thresholds: {
    highEngagementScoreMin: number;
    lowEngagementScoreMax: number;
  };
  returningRate: number;
}

interface SegmentCountsFacetResult {
  total?: { count: number }[];
  highEngagement?: { count: number }[];
  lowEngagement?: { count: number }[];
  midEngagement?: { count: number }[];
  returningUsers?: { count: number }[];
}

const computeReturningRate = (counts: AudienceSegmentCounts): number => {
  if (counts.total === 0) {
    return 0;
  }

  return counts.returningUsers / counts.total;
};

export const getAudienceSegmentCounts = async (
  userIdString: string,
): Promise<AudienceSegmentSummary> => {
  const userObjectId = new Types.ObjectId(userIdString);

  const segmentCountsAggregationPipeline: PipelineStage[] = [
    { $match: { userId: userObjectId } },
    {
      $facet: {
        total: [{ $count: "count" }],
        highEngagement: [
          { $match: { engagementScore: { $gte: HIGH_ENGAGEMENT_SCORE_MIN } } },
          { $count: "count" },
        ],
        lowEngagement: [
          { $match: { engagementScore: { $lte: LOW_ENGAGEMENT_SCORE_MAX } } },
          { $count: "count" },
        ],
        midEngagement: [
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
        returningUsers: [
          { $match: { isReturning: true } },
          { $count: "count" },
        ],
      },
    },
  ];

  const [aggregateResult] = (await UsersAggregatedModel.aggregate(
    segmentCountsAggregationPipeline,
  )) as SegmentCountsFacetResult[];

  const counts: AudienceSegmentCounts = {
    total: aggregateResult?.total?.[0]?.count ?? 0,
    highEngagement: aggregateResult?.highEngagement?.[0]?.count ?? 0,
    lowEngagement: aggregateResult?.lowEngagement?.[0]?.count ?? 0,
    midEngagement: aggregateResult?.midEngagement?.[0]?.count ?? 0,
    returningUsers: aggregateResult?.returningUsers?.[0]?.count ?? 0,
  };

  return {
    ...counts,
    thresholds: getAudienceEngagementThresholds(),
    returningRate: computeReturningRate(counts),
  };
};

export interface AudienceCohortRow {
  cohortDate: string;
  primaryPlatform: string;
  users: number;
  returningUsers: number;
  highEngagementUsers: number;
  lowEngagementUsers: number;
  avgEngagement: number;
  avgDuration: number;
  avgScrollDepth: number;
  bounceRate: number;
}

export interface GetCohortMetricsOptions {
  userId: string;
  fromCohortDate?: string;
  toCohortDate?: string;
  primaryPlatform?: string;
  limit?: number;
}

interface CohortMetricsMongoFilter {
  userId: Types.ObjectId;
  cohortDate?: { $gte?: string; $lte?: string };
  primaryPlatform?: string;
}

export const getCohortMetrics = async (
  options: GetCohortMetricsOptions,
): Promise<AudienceCohortRow[]> => {
  const userObjectId = new Types.ObjectId(options.userId);
  const cohortFilter: CohortMetricsMongoFilter = { userId: userObjectId };

  if (options.fromCohortDate || options.toCohortDate) {
    const cohortDateRange: { $gte?: string; $lte?: string } = {};

    if (options.fromCohortDate) {
      cohortDateRange.$gte = options.fromCohortDate;
    }

    if (options.toCohortDate) {
      cohortDateRange.$lte = options.toCohortDate;
    }

    cohortFilter.cohortDate = cohortDateRange;
  }

  if (options.primaryPlatform && options.primaryPlatform.trim().length > 0) {
    cohortFilter.primaryPlatform = options.primaryPlatform.trim();
  }

  const queryLimit = Math.min(Math.max(options.limit ?? 200, 1), 1000);

  const cohortDocuments = await CohortMetricsDailyModel.find(cohortFilter)
    .sort({ cohortDate: -1, primaryPlatform: 1 })
    .limit(queryLimit)
    .lean();

  return cohortDocuments.map((cohortDocument) => ({
    cohortDate: cohortDocument.cohortDate,
    primaryPlatform: cohortDocument.primaryPlatform,
    users: cohortDocument.users ?? 0,
    returningUsers: cohortDocument.returningUsers ?? 0,
    highEngagementUsers: cohortDocument.highEngagementUsers ?? 0,
    lowEngagementUsers: cohortDocument.lowEngagementUsers ?? 0,
    avgEngagement: cohortDocument.avgEngagement ?? 0,
    avgDuration: cohortDocument.avgDuration ?? 0,
    avgScrollDepth: cohortDocument.avgScrollDepth ?? 0,
    bounceRate: cohortDocument.bounceRate ?? 0,
  }));
};

export type AudienceUserSegmentFilter = AudienceSegmentLabel | "all";
export type AudienceUserSortField =
  | "engagementScore"
  | "totalSessions"
  | "lastVisitAt"
  | "firstVisitAt";

export interface ListUsersAggregatedOptions {
  userId: string;
  page: number;
  pageSize: number;
  segment: AudienceUserSegmentFilter;
  primaryPlatform?: string;
  sortBy?: AudienceUserSortField;
}

export interface AudienceUserRow {
  userTrackingId: string;
  totalSessions: number;
  bounceSessions: number;
  engagedSessions: number;
  avgDuration: number;
  avgScrollDepth: number;
  bounceRate: number;
  engagementScore: number;
  isReturning: boolean;
  primaryPlatform: string;
  distinctPlatformCount: number;
  firstVisitAt: string;
  lastVisitAt: string;
  segment: "highEngagement" | "lowEngagement" | "midEngagement";
}

export interface ListUsersAggregatedResult {
  rows: AudienceUserRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface UsersAggregatedSegmentFilterClause {
  engagementScore?: { $gte?: number; $lte?: number; $gt?: number; $lt?: number };
  isReturning?: boolean;
}

const buildSegmentFilterClause = (
  segmentFilter: AudienceUserSegmentFilter,
): UsersAggregatedSegmentFilterClause => {
  switch (segmentFilter) {
    case "highEngagement":
      return { engagementScore: { $gte: HIGH_ENGAGEMENT_SCORE_MIN } };
    case "lowEngagement":
      return { engagementScore: { $lte: LOW_ENGAGEMENT_SCORE_MAX } };
    case "midEngagement":
      return {
        engagementScore: {
          $gt: LOW_ENGAGEMENT_SCORE_MAX,
          $lt: HIGH_ENGAGEMENT_SCORE_MIN,
        },
      };
    case "returning":
      return { isReturning: true };
    case "all":
    default:
      return {};
  }
};

const buildSortStageForUsersAggregated = (
  sortField: AudienceUserSortField,
): Record<string, 1 | -1> => {
  switch (sortField) {
    case "totalSessions":
      return { totalSessions: -1, engagementScore: -1 };
    case "lastVisitAt":
      return { lastVisitAt: -1 };
    case "firstVisitAt":
      return { firstVisitAt: -1 };
    case "engagementScore":
    default:
      return { engagementScore: -1, lastVisitAt: -1 };
  }
};

export const listUsersAggregated = async (
  options: ListUsersAggregatedOptions,
): Promise<ListUsersAggregatedResult> => {
  const userObjectId = new Types.ObjectId(options.userId);
  const safePage = Math.max(options.page, 1);
  const safePageSize = Math.min(Math.max(options.pageSize, 1), 100);
  const skipCount = (safePage - 1) * safePageSize;

  const filter: UsersAggregatedSegmentFilterClause & {
    userId: Types.ObjectId;
    primaryPlatform?: string;
  } = {
    userId: userObjectId,
    ...buildSegmentFilterClause(options.segment),
  };

  if (options.primaryPlatform && options.primaryPlatform.trim().length > 0) {
    filter.primaryPlatform = options.primaryPlatform.trim();
  }

  const sortStage = buildSortStageForUsersAggregated(
    options.sortBy ?? "engagementScore",
  );

  const [userDocuments, totalCount] = await Promise.all([
    UsersAggregatedModel.find(filter)
      .sort(sortStage)
      .skip(skipCount)
      .limit(safePageSize)
      .lean(),
    UsersAggregatedModel.countDocuments(filter),
  ]);

  const rows: AudienceUserRow[] = userDocuments.map((userDocument) => ({
    userTrackingId: userDocument.userTrackingId,
    totalSessions: userDocument.totalSessions ?? 0,
    bounceSessions: userDocument.bounceSessions ?? 0,
    engagedSessions: userDocument.engagedSessions ?? 0,
    avgDuration: userDocument.avgDuration ?? 0,
    avgScrollDepth: userDocument.avgScrollDepth ?? 0,
    bounceRate: userDocument.bounceRate ?? 0,
    engagementScore: userDocument.engagementScore ?? 0,
    isReturning: userDocument.isReturning ?? false,
    primaryPlatform: userDocument.primaryPlatform ?? "unknown",
    distinctPlatformCount: userDocument.distinctPlatformCount ?? 0,
    firstVisitAt: new Date(userDocument.firstVisitAt).toISOString(),
    lastVisitAt: new Date(userDocument.lastVisitAt).toISOString(),
    segment: classifyEngagementSegment(userDocument.engagementScore ?? 0),
  }));

  return {
    rows,
    page: safePage,
    pageSize: safePageSize,
    totalCount,
    totalPages:
      safePageSize > 0 ? Math.ceil(totalCount / safePageSize) : 0,
  };
};

export interface AudienceInsightRow {
  insightId: string;
  message: string;
  confidence: number;
  signature: string;
  metadata: unknown;
  createdAt: string;
}

export interface ListAudienceInsightsOptions {
  userId: string;
  limit?: number;
}

export const listAudienceInsights = async (
  options: ListAudienceInsightsOptions,
): Promise<AudienceInsightRow[]> => {
  const queryLimit = Math.min(Math.max(options.limit ?? 10, 1), 50);

  const insightDocuments = await InsightReadModel.find({
    userId: options.userId,
    type: "audience",
  })
    .sort({ createdAt: -1 })
    .limit(queryLimit)
    .lean();

  return insightDocuments.map((insightDocument) => ({
    insightId: insightDocument._id.toString(),
    message: insightDocument.message,
    confidence: insightDocument.confidence,
    signature: insightDocument.signature,
    metadata: insightDocument.metadata,
    createdAt: new Date(insightDocument.createdAt).toISOString(),
  }));
};

export interface AudienceEngagementHistogramBin {
  bucketLabel: string;
  bucketStart: number;
  bucketEnd: number;
  userCount: number;
}

export const getAudienceEngagementHistogram = async (
  userIdString: string,
): Promise<AudienceEngagementHistogramBin[]> => {
  const userObjectId = new Types.ObjectId(userIdString);

  const bucketBoundaries = [
    0, 10, 20, 30, 40, 50, 60, 70, 80, 90, Number.MAX_SAFE_INTEGER,
  ];

  type BucketAggregateRow = {
    _id: number;
    count: number;
  };

  const bucketAggregateRows = await UsersAggregatedModel.aggregate<
    BucketAggregateRow
  >([
    { $match: { userId: userObjectId } },
    {
      $bucket: {
        groupBy: "$engagementScore",
        boundaries: bucketBoundaries,
        default: "other",
        output: { count: { $sum: 1 } },
      },
    },
  ]);

  const histogramBins: AudienceEngagementHistogramBin[] = [];

  for (
    let boundaryIndex = 0;
    boundaryIndex < bucketBoundaries.length - 1;
    boundaryIndex += 1
  ) {
    const bucketStart = bucketBoundaries[boundaryIndex];
    const bucketEnd = bucketBoundaries[boundaryIndex + 1];
    const matchingRow = bucketAggregateRows.find(
      (aggregateRow) => aggregateRow._id === bucketStart,
    );

    histogramBins.push({
      bucketLabel:
        bucketEnd === Number.MAX_SAFE_INTEGER
          ? `${bucketStart}+`
          : `${bucketStart}-${bucketEnd}`,
      bucketStart,
      bucketEnd: bucketEnd === Number.MAX_SAFE_INTEGER ? bucketStart : bucketEnd,
      userCount: matchingRow?.count ?? 0,
    });
  }

  return histogramBins;
};
