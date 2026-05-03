import { ClickEventModel } from "../api/models/clickEvent.model.js";
import { LinkModel } from "../api/models/link.model.js";
import {
  calculatePercentage,
  getRangeStartDate,
  type TrendRange,
  toObjectId,
} from "../utils/analytics.helpers.js";

export type PlatformStat = {
  platform: string;
  clicks: number;
  percentage: number;
};

export type TopLinkStat = {
  linkId: string;
  shortCode: string | null;
  originalUrl: string | null;
  platform: string | null;
  clicks: number;
  percentage: number;
};

export type OverviewAnalytics = {
  totalClicks: number;
  activeLinks: number;
  avgClicksPerLink: number;
  topPlatform: PlatformStat | null;
  topLink: TopLinkStat | null;
};

export type TrendPoint = {
  date: string;
  clicks: number;
};

export type PlatformComparison = Record<string, { clicks: number }>;

type AggregatedPlatformStat = {
  platform: string;
  clicks: number;
};

type AggregatedTopLinkStat = {
  linkId: string;
  shortCode: string | null;
  originalUrl: string | null;
  platform: string | null;
  clicks: number;
};

export const getPlatformStats = async (userId: string): Promise<PlatformStat[]> => {
  const userObjectId = toObjectId(userId);

  const [totalClicks, platformStats] = await Promise.all([
    ClickEventModel.countDocuments({ userId: userObjectId }),
    ClickEventModel.aggregate<AggregatedPlatformStat>([
      { $match: { userId: userObjectId } },
      { $group: { _id: "$platform", clicks: { $sum: 1 } } },
      { $project: { _id: 0, platform: "$_id", clicks: 1 } },
      { $sort: { clicks: -1 } },
    ]),
  ]);

  return platformStats.map((platformStat) => ({
    ...platformStat,
    percentage: calculatePercentage(platformStat.clicks, totalClicks),
  }));
};

export const getTopLinks = async (userId: string): Promise<TopLinkStat[]> => {
  const userObjectId = toObjectId(userId);

  const [totalClicks, topLinks] = await Promise.all([
    ClickEventModel.countDocuments({ userId: userObjectId }),
    ClickEventModel.aggregate<AggregatedTopLinkStat>([
      { $match: { userId: userObjectId } },
      { $group: { _id: "$linkId", clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      {
        $lookup: {
          from: LinkModel.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "link",
        },
      },
      { $unwind: { path: "$link", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          linkId: { $toString: "$_id" },
          clicks: 1,
          shortCode: "$link.shortCode",
          originalUrl: "$link.originalUrl",
          platform: "$link.platform",
        },
      },
    ]),
  ]);

  return topLinks.map((topLinkStat) => ({
    ...topLinkStat,
    percentage: calculatePercentage(topLinkStat.clicks, totalClicks),
  }));
};

export const getOverview = async (userId: string): Promise<OverviewAnalytics> => {
  const userObjectId = toObjectId(userId);

  const [totalClicks, activeLinks, platformStats, topLinks] = await Promise.all([
    ClickEventModel.countDocuments({ userId: userObjectId }),
    LinkModel.countDocuments({ userId: userObjectId }),
    getPlatformStats(userId),
    getTopLinks(userId),
  ]);

  return {
    totalClicks,
    activeLinks,
    avgClicksPerLink: activeLinks > 0 ? Number((totalClicks / activeLinks).toFixed(2)) : 0,
    topPlatform: platformStats[0] ?? null,
    topLink: topLinks[0] ?? null,
  };
};

export const getClickTrends = async (
  userId: string,
  range: TrendRange,
): Promise<TrendPoint[]> => {
  const userObjectId = toObjectId(userId);
  const rangeStartDate = getRangeStartDate(range);

  const trendPoints = await ClickEventModel.aggregate<TrendPoint>([
    { $match: { userId: userObjectId } },
    { $match: { timestamp: { $gte: rangeStartDate } } },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$timestamp",
          },
        },
        clicks: { $sum: 1 },
      },
    },
    { $project: { _id: 0, date: "$_id", clicks: 1 } },
    { $sort: { date: 1 } },
  ]);

  return trendPoints;
};

export const compareAnalyticsByPlatform = async (
  userId: string,
): Promise<PlatformComparison> => {
  const userObjectId = toObjectId(userId);

  const platformStats = await ClickEventModel.aggregate<AggregatedPlatformStat>([
    { $match: { userId: userObjectId } },
    { $group: { _id: "$platform", clicks: { $sum: 1 } } },
    { $sort: { clicks: -1 } },
    {
      $project: {
        _id: 0,
        platform: "$_id",
        clicks: 1,
      },
    },
  ]);

  return platformStats.reduce<PlatformComparison>((comparisonByPlatform, platformStat) => {
    comparisonByPlatform[platformStat.platform] = { clicks: platformStat.clicks };
    return comparisonByPlatform;
  }, {});
};
