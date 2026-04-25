import { Types } from "mongoose";

import { ClickEventModel } from "../api/models/clickEvent.model";
import { LinkModel } from "../api/models/link.model";

type PlatformStat = {
  platform: string;
  clicks: number;
};

type TopLinkStat = {
  linkId: string;
  shortCode: string | null;
  originalUrl: string | null;
  clicks: number;
};

type OverviewAnalytics = {
  totalClicks: number;
  topPlatform: PlatformStat | null;
  topLink: TopLinkStat | null;
};

const toObjectId = (id: string): Types.ObjectId => new Types.ObjectId(id);

export const getPlatformStats = async (userId: string): Promise<PlatformStat[]> => {
  const userObjectId = toObjectId(userId);

  const platformStats = await ClickEventModel.aggregate<PlatformStat>([
    { $match: { userId: userObjectId } },
    { $group: { _id: "$platform", clicks: { $sum: 1 } } },
    { $project: { _id: 0, platform: "$_id", clicks: 1 } },
    { $sort: { clicks: -1 } },
  ]);

  return platformStats;
};

export const getTopLinks = async (userId: string): Promise<TopLinkStat[]> => {
  const userObjectId = toObjectId(userId);

  const topLinks = await ClickEventModel.aggregate<TopLinkStat>([
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
      },
    },
  ]);

  return topLinks;
};

export const getOverview = async (userId: string): Promise<OverviewAnalytics> => {
  const userObjectId = toObjectId(userId);

  const [totalClicks, platformStats, topLinks] = await Promise.all([
    ClickEventModel.countDocuments({ userId: userObjectId }),
    getPlatformStats(userId),
    getTopLinks(userId),
  ]);

  return {
    totalClicks,
    topPlatform: platformStats[0] ?? null,
    topLink: topLinks[0] ?? null,
  };
};
