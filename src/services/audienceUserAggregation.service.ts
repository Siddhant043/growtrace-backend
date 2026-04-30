import type { AnyBulkWriteOperation, PipelineStage } from "mongoose";
import { Types } from "mongoose";

import { SessionModel } from "../api/models/session.model";
import {
  UsersAggregatedModel,
  type UsersAggregatedDocument,
} from "../api/models/usersAggregated.model";
import {
  ENGAGED_DURATION_THRESHOLD_SECONDS,
  ENGAGED_SCROLL_DEPTH_THRESHOLD,
  ENGAGEMENT_SCROLL_WEIGHT,
  ENGAGEMENT_TIME_WEIGHT,
  SESSION_DURATION_CAP_SECONDS,
} from "../api/constants/engagement";
import { env } from "../config/env";

interface UserAggregationPipelineRow {
  _id: {
    userId: Types.ObjectId;
    userTrackingId: string;
  };
  totalSessions: number;
  bounceSessions: number;
  engagedSessions: number;
  totalDuration: number;
  totalScrollDepth: number;
  avgDuration: number;
  avgScrollDepth: number;
  bounceRate: number;
  engagementScore: number;
  primaryPlatform: string;
  distinctPlatformCount: number;
  isReturning: boolean;
  firstVisitAt: Date;
  lastVisitAt: Date;
}

const computeWindowStartDate = (windowDays: number): Date => {
  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);
  return windowStart;
};

const buildUserAggregationPipeline = (
  userId: Types.ObjectId,
  windowStart: Date,
): PipelineStage[] => [
  {
    $match: {
      userId,
      userTrackingId: { $ne: null, $type: "string" },
      createdAt: { $gte: windowStart },
    },
  },
  {
    $addFields: {
      cappedDuration: {
        $min: [{ $ifNull: ["$duration", 0] }, SESSION_DURATION_CAP_SECONDS],
      },
      safeScrollDepth: { $ifNull: ["$maxScrollDepth", 0] },
      resolvedPlatform: { $ifNull: ["$platform", "unknown"] },
    },
  },
  {
    $group: {
      _id: { userId: "$userId", userTrackingId: "$userTrackingId" },
      totalSessions: { $sum: 1 },
      bounceSessions: { $sum: { $cond: ["$isBounce", 1, 0] } },
      totalDuration: { $sum: "$cappedDuration" },
      totalScrollDepth: { $sum: "$safeScrollDepth" },
      engagedSessions: {
        $sum: {
          $cond: [
            {
              $and: [
                {
                  $gt: ["$cappedDuration", ENGAGED_DURATION_THRESHOLD_SECONDS],
                },
                { $gt: ["$safeScrollDepth", ENGAGED_SCROLL_DEPTH_THRESHOLD] },
              ],
            },
            1,
            0,
          ],
        },
      },
      firstVisitAt: { $min: "$createdAt" },
      lastVisitAt: { $max: "$createdAt" },
      platformOccurrences: { $push: "$resolvedPlatform" },
      distinctPlatformsArray: { $addToSet: "$resolvedPlatform" },
    },
  },
  {
    $addFields: {
      avgDuration: {
        $cond: [
          { $gt: ["$totalSessions", 0] },
          { $divide: ["$totalDuration", "$totalSessions"] },
          0,
        ],
      },
      avgScrollDepth: {
        $cond: [
          { $gt: ["$totalSessions", 0] },
          { $divide: ["$totalScrollDepth", "$totalSessions"] },
          0,
        ],
      },
      bounceRate: {
        $cond: [
          { $gt: ["$totalSessions", 0] },
          { $divide: ["$bounceSessions", "$totalSessions"] },
          0,
        ],
      },
      distinctPlatformCount: { $size: "$distinctPlatformsArray" },
      isReturning: { $gt: ["$totalSessions", 1] },
    },
  },
  {
    $addFields: {
      engagementScore: {
        $add: [
          { $multiply: [ENGAGEMENT_TIME_WEIGHT, "$avgDuration"] },
          { $multiply: [ENGAGEMENT_SCROLL_WEIGHT, "$avgScrollDepth"] },
        ],
      },
      platformCounts: {
        $map: {
          input: "$distinctPlatformsArray",
          as: "candidatePlatform",
          in: {
            platform: "$$candidatePlatform",
            count: {
              $size: {
                $filter: {
                  input: "$platformOccurrences",
                  as: "occurrence",
                  cond: { $eq: ["$$occurrence", "$$candidatePlatform"] },
                },
              },
            },
          },
        },
      },
    },
  },
  {
    $addFields: {
      primaryPlatformObject: {
        $reduce: {
          input: "$platformCounts",
          initialValue: { platform: "unknown", count: -1 },
          in: {
            $cond: [
              { $gt: ["$$this.count", "$$value.count"] },
              "$$this",
              "$$value",
            ],
          },
        },
      },
    },
  },
  {
    $addFields: {
      primaryPlatform: {
        $ifNull: ["$primaryPlatformObject.platform", "unknown"],
      },
    },
  },
  {
    $project: {
      platformOccurrences: 0,
      distinctPlatformsArray: 0,
      platformCounts: 0,
      primaryPlatformObject: 0,
    },
  },
];

export const runAudienceUserAggregationForUser = async (
  userIdString: string,
): Promise<number> => {
  if (!Types.ObjectId.isValid(userIdString)) {
    return 0;
  }

  const userId = new Types.ObjectId(userIdString);
  const windowStart = computeWindowStartDate(
    env.AUDIENCE_AGGREGATION_WINDOW_DAYS,
  );

  const aggregatedRows = await SessionModel.aggregate<UserAggregationPipelineRow>(
    buildUserAggregationPipeline(userId, windowStart),
  );

  if (aggregatedRows.length === 0) {
    return 0;
  }

  const bulkWriteOperations: AnyBulkWriteOperation<UsersAggregatedDocument>[] =
    aggregatedRows.map((aggregateRow) => ({
      updateOne: {
        filter: {
          userId: aggregateRow._id.userId,
          userTrackingId: aggregateRow._id.userTrackingId,
        },
        update: {
          $set: {
            totalSessions: aggregateRow.totalSessions,
            bounceSessions: aggregateRow.bounceSessions,
            engagedSessions: aggregateRow.engagedSessions,
            avgDuration: aggregateRow.avgDuration,
            avgScrollDepth: aggregateRow.avgScrollDepth,
            bounceRate: aggregateRow.bounceRate,
            engagementScore: aggregateRow.engagementScore,
            isReturning: aggregateRow.isReturning,
            primaryPlatform: aggregateRow.primaryPlatform,
            distinctPlatformCount: aggregateRow.distinctPlatformCount,
            firstVisitAt: aggregateRow.firstVisitAt,
            lastVisitAt: aggregateRow.lastVisitAt,
          },
        },
        upsert: true,
      },
    }));

  await UsersAggregatedModel.bulkWrite(bulkWriteOperations, { ordered: false });
  return aggregatedRows.length;
};

export const listActiveUserIdsInAggregationWindow = async (): Promise<
  string[]
> => {
  const windowStart = computeWindowStartDate(
    env.AUDIENCE_AGGREGATION_WINDOW_DAYS,
  );

  const distinctUserIds = await SessionModel.distinct("userId", {
    userTrackingId: { $ne: null, $type: "string" },
    createdAt: { $gte: windowStart },
  });

  return distinctUserIds.map((distinctUserId) => distinctUserId.toString());
};
