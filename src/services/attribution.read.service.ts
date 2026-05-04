import { Types, type PipelineStage } from "mongoose";

import { JourneyModel } from "../api/models/journey.model.js";
import { TouchpointModel } from "../api/models/touchpoint.model.js";

const UNKNOWN_PLATFORM_LABEL = "unknown";

export interface AttributionPlatformBreakdownEntry {
  platform: string;
  journeyCount: number;
}

export interface AttributionSummary {
  totalJourneys: number;
  closedJourneys: number;
  openJourneys: number;
  averageTouchpointsPerJourney: number;
  averageDistinctPlatformsPerJourney: number;
  conversionsFromClosedJourneys: number;
  firstTouchByPlatform: AttributionPlatformBreakdownEntry[];
  lastTouchByPlatform: AttributionPlatformBreakdownEntry[];
}

export interface AttributionRecentJourneyEntry {
  journeyId: string;
  userTrackingId: string;
  firstTouchPlatform: string | null;
  firstTouchAt: string | null;
  lastTouchPlatform: string | null;
  lastTouchAt: string | null;
  touchpointCount: number;
  distinctPlatformCount: number;
  isClosed: boolean;
}

export interface AttributionJourneyTouchpointEntry {
  touchpointId: string;
  type: string;
  platform: string | null;
  linkId: string | null;
  sessionId: string | null;
  timestamp: string;
}

export interface AttributionJourneyDetail {
  journeyId: string;
  userTrackingId: string;
  isClosed: boolean;
  closedReason: string | null;
  firstTouchPlatform: string | null;
  firstTouchAt: string | null;
  lastTouchPlatform: string | null;
  lastTouchAt: string | null;
  touchpointCount: number;
  distinctPlatformCount: number;
  touchpoints: AttributionJourneyTouchpointEntry[];
}

const buildPlatformBreakdownPipelineStage = (
  platformPath: string,
): PipelineStage.FacetPipelineStage[] => [
  {
    $group: {
      _id: { $ifNull: [`$${platformPath}`, UNKNOWN_PLATFORM_LABEL] },
      journeyCount: { $sum: 1 },
    },
  },
  { $sort: { journeyCount: -1, _id: 1 } },
  {
    $project: {
      _id: 0,
      platform: "$_id",
      journeyCount: 1,
    },
  },
];

interface PlatformBreakdownAggregateRow {
  platform: string;
  journeyCount: number;
}

interface SummaryFacetResult {
  totals?: {
    totalJourneys: number;
    closedJourneys: number;
    openJourneys: number;
    averageTouchpointsPerJourney: number;
    averageDistinctPlatformsPerJourney: number;
  }[];
  conversions?: { conversionsFromClosedJourneys: number }[];
  firstTouchByPlatform?: PlatformBreakdownAggregateRow[];
  lastTouchByPlatform?: PlatformBreakdownAggregateRow[];
}

export const getAttributionSummary = async (
  userId: string,
): Promise<AttributionSummary> => {
  const userObjectId = new Types.ObjectId(userId);

  const aggregationPipeline: PipelineStage[] = [
    { $match: { userId: userObjectId } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalJourneys: { $sum: 1 },
              closedJourneys: {
                $sum: { $cond: ["$isClosed", 1, 0] },
              },
              openJourneys: {
                $sum: { $cond: ["$isClosed", 0, 1] },
              },
              averageTouchpointsPerJourney: { $avg: "$touchpointCount" },
              averageDistinctPlatformsPerJourney: {
                $avg: "$distinctPlatformCount",
              },
            },
          },
          {
            $project: {
              _id: 0,
              totalJourneys: 1,
              closedJourneys: 1,
              openJourneys: 1,
              averageTouchpointsPerJourney: {
                $round: ["$averageTouchpointsPerJourney", 2],
              },
              averageDistinctPlatformsPerJourney: {
                $round: ["$averageDistinctPlatformsPerJourney", 2],
              },
            },
          },
        ],
        conversions: [
          { $match: { "lastTouch.type": "conversion" } },
          {
            $group: {
              _id: null,
              conversionsFromClosedJourneys: { $sum: 1 },
            },
          },
          {
            $project: { _id: 0, conversionsFromClosedJourneys: 1 },
          },
        ],
        firstTouchByPlatform: buildPlatformBreakdownPipelineStage(
          "firstTouch.platform",
        ),
        lastTouchByPlatform: buildPlatformBreakdownPipelineStage(
          "lastTouch.platform",
        ),
      },
    },
  ];

  const [aggregateResult] = (await JourneyModel.aggregate(
    aggregationPipeline,
  )) as SummaryFacetResult[];

  const totalsRow = aggregateResult?.totals?.[0];

  return {
    totalJourneys: totalsRow?.totalJourneys ?? 0,
    closedJourneys: totalsRow?.closedJourneys ?? 0,
    openJourneys: totalsRow?.openJourneys ?? 0,
    averageTouchpointsPerJourney: totalsRow?.averageTouchpointsPerJourney ?? 0,
    averageDistinctPlatformsPerJourney:
      totalsRow?.averageDistinctPlatformsPerJourney ?? 0,
    conversionsFromClosedJourneys:
      aggregateResult?.conversions?.[0]?.conversionsFromClosedJourneys ?? 0,
    firstTouchByPlatform: aggregateResult?.firstTouchByPlatform ?? [],
    lastTouchByPlatform: aggregateResult?.lastTouchByPlatform ?? [],
  };
};

export interface GetRecentJourneysOptions {
  userId: string;
  limit: number;
}

export const getRecentJourneys = async (
  recentJourneysOptions: GetRecentJourneysOptions,
): Promise<AttributionRecentJourneyEntry[]> => {
  const userObjectId = new Types.ObjectId(recentJourneysOptions.userId);
  const queryLimit = Math.min(
    Math.max(recentJourneysOptions.limit, 1),
    100,
  );

  const recentJourneyDocuments = await JourneyModel.find({
    userId: userObjectId,
  })
    .sort({ updatedAt: -1 })
    .limit(queryLimit)
    .lean();

  return recentJourneyDocuments.map((journeyDocument) => ({
    journeyId: journeyDocument._id.toString(),
    userTrackingId: journeyDocument.userTrackingId,
    firstTouchPlatform: journeyDocument.firstTouch?.platform ?? null,
    firstTouchAt: journeyDocument.firstTouch?.timestamp
      ? new Date(journeyDocument.firstTouch.timestamp).toISOString()
      : null,
    lastTouchPlatform: journeyDocument.lastTouch?.platform ?? null,
    lastTouchAt: journeyDocument.lastTouch?.timestamp
      ? new Date(journeyDocument.lastTouch.timestamp).toISOString()
      : null,
    touchpointCount: journeyDocument.touchpointCount ?? 0,
    distinctPlatformCount: journeyDocument.distinctPlatformCount ?? 0,
    isClosed: journeyDocument.isClosed ?? false,
  }));
};

export interface GetJourneyDetailOptions {
  userId: string;
  userTrackingId: string;
}

export const getJourneyDetailForUserTrackingId = async (
  options: GetJourneyDetailOptions,
): Promise<AttributionJourneyDetail | null> => {
  const userObjectId = new Types.ObjectId(options.userId);
  const trimmedTrackingId = options.userTrackingId.trim();

  const latestJourneyForTrackingId = await JourneyModel.findOne({
    userId: userObjectId,
    userTrackingId: trimmedTrackingId,
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (!latestJourneyForTrackingId) {
    return null;
  }

  const journeyTouchpointDocuments = await TouchpointModel.find({
    journeyId: latestJourneyForTrackingId._id,
    userId: userObjectId,
  })
    .sort({ timestamp: 1 })
    .lean();

  return {
    journeyId: latestJourneyForTrackingId._id.toString(),
    userTrackingId: latestJourneyForTrackingId.userTrackingId,
    isClosed: latestJourneyForTrackingId.isClosed ?? false,
    closedReason: latestJourneyForTrackingId.closedReason ?? null,
    firstTouchPlatform: latestJourneyForTrackingId.firstTouch?.platform ?? null,
    firstTouchAt: latestJourneyForTrackingId.firstTouch?.timestamp
      ? new Date(
          latestJourneyForTrackingId.firstTouch.timestamp,
        ).toISOString()
      : null,
    lastTouchPlatform: latestJourneyForTrackingId.lastTouch?.platform ?? null,
    lastTouchAt: latestJourneyForTrackingId.lastTouch?.timestamp
      ? new Date(latestJourneyForTrackingId.lastTouch.timestamp).toISOString()
      : null,
    touchpointCount: latestJourneyForTrackingId.touchpointCount ?? 0,
    distinctPlatformCount:
      latestJourneyForTrackingId.distinctPlatformCount ?? 0,
    touchpoints: journeyTouchpointDocuments.map((touchpointDocument) => ({
      touchpointId: touchpointDocument._id.toString(),
      type: touchpointDocument.type,
      platform: touchpointDocument.platform ?? null,
      linkId: touchpointDocument.linkId
        ? touchpointDocument.linkId.toString()
        : null,
      sessionId: touchpointDocument.sessionId ?? null,
      timestamp: new Date(touchpointDocument.timestamp).toISOString(),
    })),
  };
};
