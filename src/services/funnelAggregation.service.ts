import type { AnyBulkWriteOperation } from "mongoose";
import { Types } from "mongoose";

import { ClickEventModel } from "../api/models/clickEvent.model";
import { SessionModel } from "../api/models/session.model";
import type { LinkPlatform } from "../api/models/link.model";
import {
  LinkFunnelDailyModel,
  type LinkFunnelDailyDocument,
} from "../api/models/linkFunnelDaily.model";
import {
  PlatformFunnelDailyModel,
  type PlatformFunnelDailyDocument,
} from "../api/models/platformFunnelDaily.model";
import {
  CampaignFunnelDailyModel,
  type CampaignFunnelDailyDocument,
} from "../api/models/campaignFunnelDaily.model";
import {
  ENGAGED_DURATION_THRESHOLD_SECONDS,
  ENGAGED_SCROLL_DEPTH_THRESHOLD,
  SESSION_DURATION_CAP_SECONDS,
} from "../api/constants/engagement";
import { computeDayBoundsUtc } from "../utils/dateBounds.utils";

type FunnelStageCounts = {
  clicks: number;
  visits: number;
  engaged: number;
};

type FunnelDerivedMetrics = {
  visitRate: number;
  engagementRate: number;
  dropClickToVisit: number;
  dropVisitToEngaged: number;
};

const computeFunnelDerivedMetrics = (
  stageCounts: FunnelStageCounts,
): FunnelDerivedMetrics => {
  const visitRate =
    stageCounts.clicks > 0 ? stageCounts.visits / stageCounts.clicks : 0;
  const engagementRate =
    stageCounts.visits > 0 ? stageCounts.engaged / stageCounts.visits : 0;
  const dropClickToVisit =
    stageCounts.clicks > 0 ? Math.max(0, 1 - visitRate) : 0;
  const dropVisitToEngaged =
    stageCounts.visits > 0 ? 1 - engagementRate : 0;

  return {
    visitRate,
    engagementRate,
    dropClickToVisit,
    dropVisitToEngaged,
  };
};

type ClicksPipelineRow<TGroupKey> = {
  _id: TGroupKey;
  clicks: number;
};

type SessionsPipelineRow<TGroupKey> = {
  _id: TGroupKey;
  visits: number;
  engaged: number;
};

const buildSessionsAggregationStages = (dayStart: Date, dayEnd: Date) => [
  {
    $match: {
      createdAt: { $gte: dayStart, $lt: dayEnd },
    },
  },
  {
    $addFields: {
      cappedDuration: {
        $min: [{ $ifNull: ["$duration", 0] }, SESSION_DURATION_CAP_SECONDS],
      },
      safeScrollDepth: { $ifNull: ["$maxScrollDepth", 0] },
    },
  },
];

const buildSessionGroupAccumulators = () => ({
  visits: { $sum: 1 },
  engaged: {
    $sum: {
      $cond: [
        {
          $and: [
            { $gt: ["$cappedDuration", ENGAGED_DURATION_THRESHOLD_SECONDS] },
            { $gt: ["$safeScrollDepth", ENGAGED_SCROLL_DEPTH_THRESHOLD] },
          ],
        },
        1,
        0,
      ],
    },
  },
});

type LinkScopeKey = {
  userId: Types.ObjectId;
  linkId: Types.ObjectId;
  platform: LinkPlatform | null;
  campaign: string | null;
};

type LinkAggregateRow = {
  userId: Types.ObjectId;
  linkId: Types.ObjectId;
  platform: LinkPlatform | null;
  campaign: string | null;
} & FunnelStageCounts;

const buildLinkScopeMapKey = (
  userId: Types.ObjectId,
  linkId: Types.ObjectId,
): string => `${userId.toString()}:${linkId.toString()}`;

export const aggregateLinkFunnelForDate = async (
  isoDate: string,
): Promise<number> => {
  const { dayStart, dayEnd } = computeDayBoundsUtc(isoDate);

  const [clickRows, sessionRows] = await Promise.all([
    ClickEventModel.aggregate<ClicksPipelineRow<LinkScopeKey>>([
      {
        $match: {
          timestamp: { $gte: dayStart, $lt: dayEnd },
          linkId: { $ne: null },
        },
      },
      {
        $group: {
          _id: {
            userId: "$userId",
            linkId: "$linkId",
            platform: "$platform",
            campaign: "$campaign",
          },
          clicks: { $sum: 1 },
        },
      },
    ]),
    SessionModel.aggregate<SessionsPipelineRow<LinkScopeKey>>([
      ...buildSessionsAggregationStages(dayStart, dayEnd),
      { $match: { linkId: { $ne: null } } },
      {
        $group: {
          _id: {
            userId: "$userId",
            linkId: "$linkId",
            platform: "$platform",
            campaign: "$campaign",
          },
          ...buildSessionGroupAccumulators(),
        },
      },
    ]),
  ]);

  const aggregateRowsByMapKey = new Map<string, LinkAggregateRow>();

  for (const clickRow of clickRows) {
    const mapKey = buildLinkScopeMapKey(
      clickRow._id.userId,
      clickRow._id.linkId,
    );
    aggregateRowsByMapKey.set(mapKey, {
      userId: clickRow._id.userId,
      linkId: clickRow._id.linkId,
      platform: clickRow._id.platform,
      campaign: clickRow._id.campaign,
      clicks: clickRow.clicks,
      visits: 0,
      engaged: 0,
    });
  }

  for (const sessionRow of sessionRows) {
    const mapKey = buildLinkScopeMapKey(
      sessionRow._id.userId,
      sessionRow._id.linkId,
    );
    const existingAggregateRow = aggregateRowsByMapKey.get(mapKey);

    if (existingAggregateRow) {
      existingAggregateRow.visits = sessionRow.visits;
      existingAggregateRow.engaged = sessionRow.engaged;
      existingAggregateRow.platform =
        existingAggregateRow.platform ?? sessionRow._id.platform;
      existingAggregateRow.campaign =
        existingAggregateRow.campaign ?? sessionRow._id.campaign;
      continue;
    }

    aggregateRowsByMapKey.set(mapKey, {
      userId: sessionRow._id.userId,
      linkId: sessionRow._id.linkId,
      platform: sessionRow._id.platform,
      campaign: sessionRow._id.campaign,
      clicks: 0,
      visits: sessionRow.visits,
      engaged: sessionRow.engaged,
    });
  }

  if (aggregateRowsByMapKey.size === 0) {
    return 0;
  }

  const bulkWriteOperations: AnyBulkWriteOperation<LinkFunnelDailyDocument>[] =
    Array.from(aggregateRowsByMapKey.values()).map((aggregateRow) => {
      const derivedMetrics = computeFunnelDerivedMetrics(aggregateRow);

      return {
        updateOne: {
          filter: {
            userId: aggregateRow.userId,
            linkId: aggregateRow.linkId,
            date: isoDate,
          },
          update: {
            $set: {
              platform: aggregateRow.platform,
              campaign: aggregateRow.campaign,
              clicks: aggregateRow.clicks,
              visits: aggregateRow.visits,
              engaged: aggregateRow.engaged,
              ...derivedMetrics,
            },
          },
          upsert: true,
        },
      };
    });

  await LinkFunnelDailyModel.bulkWrite(bulkWriteOperations, {
    ordered: false,
  });
  return bulkWriteOperations.length;
};

type PlatformScopeKey = {
  userId: Types.ObjectId;
  platform: LinkPlatform;
};

type PlatformAggregateRow = {
  userId: Types.ObjectId;
  platform: LinkPlatform;
} & FunnelStageCounts;

const buildPlatformScopeMapKey = (
  userId: Types.ObjectId,
  platform: LinkPlatform,
): string => `${userId.toString()}:${platform}`;

export const aggregatePlatformFunnelForDate = async (
  isoDate: string,
): Promise<number> => {
  const { dayStart, dayEnd } = computeDayBoundsUtc(isoDate);

  const [clickRows, sessionRows] = await Promise.all([
    ClickEventModel.aggregate<ClicksPipelineRow<PlatformScopeKey>>([
      {
        $match: {
          timestamp: { $gte: dayStart, $lt: dayEnd },
          platform: { $ne: null },
        },
      },
      {
        $group: {
          _id: { userId: "$userId", platform: "$platform" },
          clicks: { $sum: 1 },
        },
      },
    ]),
    SessionModel.aggregate<SessionsPipelineRow<PlatformScopeKey>>([
      ...buildSessionsAggregationStages(dayStart, dayEnd),
      { $match: { platform: { $ne: null } } },
      {
        $group: {
          _id: { userId: "$userId", platform: "$platform" },
          ...buildSessionGroupAccumulators(),
        },
      },
    ]),
  ]);

  const aggregateRowsByMapKey = new Map<string, PlatformAggregateRow>();

  for (const clickRow of clickRows) {
    const mapKey = buildPlatformScopeMapKey(
      clickRow._id.userId,
      clickRow._id.platform,
    );
    aggregateRowsByMapKey.set(mapKey, {
      userId: clickRow._id.userId,
      platform: clickRow._id.platform,
      clicks: clickRow.clicks,
      visits: 0,
      engaged: 0,
    });
  }

  for (const sessionRow of sessionRows) {
    const mapKey = buildPlatformScopeMapKey(
      sessionRow._id.userId,
      sessionRow._id.platform,
    );
    const existingAggregateRow = aggregateRowsByMapKey.get(mapKey);

    if (existingAggregateRow) {
      existingAggregateRow.visits = sessionRow.visits;
      existingAggregateRow.engaged = sessionRow.engaged;
      continue;
    }

    aggregateRowsByMapKey.set(mapKey, {
      userId: sessionRow._id.userId,
      platform: sessionRow._id.platform,
      clicks: 0,
      visits: sessionRow.visits,
      engaged: sessionRow.engaged,
    });
  }

  if (aggregateRowsByMapKey.size === 0) {
    return 0;
  }

  const bulkWriteOperations: AnyBulkWriteOperation<PlatformFunnelDailyDocument>[] =
    Array.from(aggregateRowsByMapKey.values()).map((aggregateRow) => {
      const derivedMetrics = computeFunnelDerivedMetrics(aggregateRow);

      return {
        updateOne: {
          filter: {
            userId: aggregateRow.userId,
            platform: aggregateRow.platform,
            date: isoDate,
          },
          update: {
            $set: {
              clicks: aggregateRow.clicks,
              visits: aggregateRow.visits,
              engaged: aggregateRow.engaged,
              ...derivedMetrics,
            },
          },
          upsert: true,
        },
      };
    });

  await PlatformFunnelDailyModel.bulkWrite(bulkWriteOperations, {
    ordered: false,
  });
  return bulkWriteOperations.length;
};

type CampaignScopeKey = {
  userId: Types.ObjectId;
  campaign: string;
};

type CampaignAggregateRow = {
  userId: Types.ObjectId;
  campaign: string;
} & FunnelStageCounts;

const buildCampaignScopeMapKey = (
  userId: Types.ObjectId,
  campaign: string,
): string => `${userId.toString()}:${campaign}`;

export const aggregateCampaignFunnelForDate = async (
  isoDate: string,
): Promise<number> => {
  const { dayStart, dayEnd } = computeDayBoundsUtc(isoDate);

  const [clickRows, sessionRows] = await Promise.all([
    ClickEventModel.aggregate<ClicksPipelineRow<CampaignScopeKey>>([
      {
        $match: {
          timestamp: { $gte: dayStart, $lt: dayEnd },
          campaign: { $nin: [null, ""] },
        },
      },
      {
        $group: {
          _id: { userId: "$userId", campaign: "$campaign" },
          clicks: { $sum: 1 },
        },
      },
    ]),
    SessionModel.aggregate<SessionsPipelineRow<CampaignScopeKey>>([
      ...buildSessionsAggregationStages(dayStart, dayEnd),
      { $match: { campaign: { $nin: [null, ""] } } },
      {
        $group: {
          _id: { userId: "$userId", campaign: "$campaign" },
          ...buildSessionGroupAccumulators(),
        },
      },
    ]),
  ]);

  const aggregateRowsByMapKey = new Map<string, CampaignAggregateRow>();

  for (const clickRow of clickRows) {
    const mapKey = buildCampaignScopeMapKey(
      clickRow._id.userId,
      clickRow._id.campaign,
    );
    aggregateRowsByMapKey.set(mapKey, {
      userId: clickRow._id.userId,
      campaign: clickRow._id.campaign,
      clicks: clickRow.clicks,
      visits: 0,
      engaged: 0,
    });
  }

  for (const sessionRow of sessionRows) {
    const mapKey = buildCampaignScopeMapKey(
      sessionRow._id.userId,
      sessionRow._id.campaign,
    );
    const existingAggregateRow = aggregateRowsByMapKey.get(mapKey);

    if (existingAggregateRow) {
      existingAggregateRow.visits = sessionRow.visits;
      existingAggregateRow.engaged = sessionRow.engaged;
      continue;
    }

    aggregateRowsByMapKey.set(mapKey, {
      userId: sessionRow._id.userId,
      campaign: sessionRow._id.campaign,
      clicks: 0,
      visits: sessionRow.visits,
      engaged: sessionRow.engaged,
    });
  }

  if (aggregateRowsByMapKey.size === 0) {
    return 0;
  }

  const bulkWriteOperations: AnyBulkWriteOperation<CampaignFunnelDailyDocument>[] =
    Array.from(aggregateRowsByMapKey.values()).map((aggregateRow) => {
      const derivedMetrics = computeFunnelDerivedMetrics(aggregateRow);

      return {
        updateOne: {
          filter: {
            userId: aggregateRow.userId,
            campaign: aggregateRow.campaign,
            date: isoDate,
          },
          update: {
            $set: {
              clicks: aggregateRow.clicks,
              visits: aggregateRow.visits,
              engaged: aggregateRow.engaged,
              ...derivedMetrics,
            },
          },
          upsert: true,
        },
      };
    });

  await CampaignFunnelDailyModel.bulkWrite(bulkWriteOperations, {
    ordered: false,
  });
  return bulkWriteOperations.length;
};

export type FunnelAggregationRunSummary = {
  date: string;
  linkRowsUpserted: number;
  platformRowsUpserted: number;
  campaignRowsUpserted: number;
};

export const aggregateAllFunnelScopesForDate = async (
  isoDate: string,
): Promise<FunnelAggregationRunSummary> => {
  const [linkRowsUpserted, platformRowsUpserted, campaignRowsUpserted] =
    await Promise.all([
      aggregateLinkFunnelForDate(isoDate),
      aggregatePlatformFunnelForDate(isoDate),
      aggregateCampaignFunnelForDate(isoDate),
    ]);

  return {
    date: isoDate,
    linkRowsUpserted,
    platformRowsUpserted,
    campaignRowsUpserted,
  };
};
