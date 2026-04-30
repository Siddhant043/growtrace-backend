import type { AnyBulkWriteOperation, PipelineStage } from "mongoose";
import { Types } from "mongoose";

import { UsersAggregatedModel } from "../api/models/usersAggregated.model";
import {
  CohortMetricsDailyModel,
  type CohortMetricsDailyDocument,
} from "../api/models/cohortMetricsDaily.model";
import { env } from "../config/env";
import {
  HIGH_ENGAGEMENT_SCORE_MIN,
  LOW_ENGAGEMENT_SCORE_MAX,
} from "../utils/audienceSegmentation.utils";

interface CohortAggregationPipelineRow {
  _id: {
    userId: Types.ObjectId;
    cohortDate: string;
    primaryPlatform: string;
  };
  users: number;
  returningUsers: number;
  highEngagementUsers: number;
  lowEngagementUsers: number;
  avgEngagement: number;
  avgDuration: number;
  avgScrollDepth: number;
  bounceRate: number;
}

const computeCohortWindowStartDate = (windowDays: number): Date => {
  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);
  return windowStart;
};

const buildCohortAggregationPipeline = (
  userId: Types.ObjectId,
  cohortWindowStart: Date,
): PipelineStage[] => [
  {
    $match: {
      userId,
      firstVisitAt: { $gte: cohortWindowStart },
    },
  },
  {
    $addFields: {
      resolvedPrimaryPlatform: {
        $ifNull: ["$primaryPlatform", "unknown"],
      },
    },
  },
  {
    $group: {
      _id: {
        userId: "$userId",
        cohortDate: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$firstVisitAt",
            timezone: "UTC",
          },
        },
        primaryPlatform: "$resolvedPrimaryPlatform",
      },
      users: { $sum: 1 },
      returningUsers: { $sum: { $cond: ["$isReturning", 1, 0] } },
      highEngagementUsers: {
        $sum: {
          $cond: [
            { $gte: ["$engagementScore", HIGH_ENGAGEMENT_SCORE_MIN] },
            1,
            0,
          ],
        },
      },
      lowEngagementUsers: {
        $sum: {
          $cond: [
            { $lte: ["$engagementScore", LOW_ENGAGEMENT_SCORE_MAX] },
            1,
            0,
          ],
        },
      },
      avgEngagement: { $avg: "$engagementScore" },
      avgDuration: { $avg: "$avgDuration" },
      avgScrollDepth: { $avg: "$avgScrollDepth" },
      bounceRate: { $avg: "$bounceRate" },
    },
  },
  {
    $addFields: {
      avgEngagement: { $ifNull: ["$avgEngagement", 0] },
      avgDuration: { $ifNull: ["$avgDuration", 0] },
      avgScrollDepth: { $ifNull: ["$avgScrollDepth", 0] },
      bounceRate: { $ifNull: ["$bounceRate", 0] },
    },
  },
];

export const runAudienceCohortAggregationForUser = async (
  userIdString: string,
): Promise<number> => {
  if (!Types.ObjectId.isValid(userIdString)) {
    return 0;
  }

  const userId = new Types.ObjectId(userIdString);
  const cohortWindowStart = computeCohortWindowStartDate(
    env.AUDIENCE_COHORT_WINDOW_DAYS,
  );

  const aggregatedRows = await UsersAggregatedModel.aggregate<CohortAggregationPipelineRow>(
    buildCohortAggregationPipeline(userId, cohortWindowStart),
  );

  if (aggregatedRows.length === 0) {
    return 0;
  }

  const bulkWriteOperations: AnyBulkWriteOperation<CohortMetricsDailyDocument>[] =
    aggregatedRows.map((cohortRow) => ({
      updateOne: {
        filter: {
          userId: cohortRow._id.userId,
          cohortDate: cohortRow._id.cohortDate,
          primaryPlatform: cohortRow._id.primaryPlatform,
        },
        update: {
          $set: {
            users: cohortRow.users,
            returningUsers: cohortRow.returningUsers,
            highEngagementUsers: cohortRow.highEngagementUsers,
            lowEngagementUsers: cohortRow.lowEngagementUsers,
            avgEngagement: cohortRow.avgEngagement,
            avgDuration: cohortRow.avgDuration,
            avgScrollDepth: cohortRow.avgScrollDepth,
            bounceRate: cohortRow.bounceRate,
          },
        },
        upsert: true,
      },
    }));

  await CohortMetricsDailyModel.bulkWrite(bulkWriteOperations, {
    ordered: false,
  });
  return aggregatedRows.length;
};
