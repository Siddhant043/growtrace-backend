import { ClickEventModel } from "../api/models/clickEvent.model";
import { LinkModel } from "../api/models/link.model";
import { calculatePercentage, toObjectId } from "../utils/analytics.helpers";

type DashboardTopPlatform = {
  platform: string;
  clicks: number;
  percentage: number;
};

type DashboardTopLink = {
  shortCode: string | null;
  clicks: number;
};

type DashboardPlatformSnapshotItem = {
  platform: string;
  clicks: number;
  percentage: number;
};

type DashboardTopLinkPreviewItem = {
  shortCode: string | null;
  clicks: number;
};

type DashboardActivityItem = {
  type: "click" | "link_created";
  message: string;
  timestamp: Date;
};

export type DashboardPayload = {
  totalClicks: number;
  activeLinks: number;
  topPlatform: DashboardTopPlatform | null;
  topLink: DashboardTopLink | null;
  platformSnapshot: DashboardPlatformSnapshotItem[];
  topLinksPreview: DashboardTopLinkPreviewItem[];
  recentActivity: DashboardActivityItem[];
  quickInsight: string;
};

type AggregatedPlatform = {
  platform: string;
  clicks: number;
};

type AggregatedTopLink = {
  linkId: string;
  shortCode: string | null;
  clicks: number;
};

type RecentClickActivity = {
  shortCode: string | null;
  clicks: number;
  timestamp: Date;
};

type RecentLinkActivity = {
  shortCode: string | null;
  createdAt: Date;
};

const getQuickInsight = (topPlatform: DashboardTopPlatform | null): string => {
  if (!topPlatform) {
    return "Create and share links to start seeing your growth insights.";
  }

  const normalizedPlatformName =
    topPlatform.platform.charAt(0).toUpperCase() + topPlatform.platform.slice(1);
  return `${normalizedPlatformName} is driving most of your traffic this week`;
};

export const getDashboardPayload = async (userId: string): Promise<DashboardPayload> => {
  const userObjectId = toObjectId(userId);

  const [
    totalClicks,
    activeLinks,
    aggregatedPlatformStats,
    aggregatedTopLinks,
    recentClickEvents,
    recentCreatedLinks,
  ] = await Promise.all([
    ClickEventModel.countDocuments({ userId: userObjectId }),
    LinkModel.countDocuments({ userId: userObjectId }),
    ClickEventModel.aggregate<AggregatedPlatform>([
      { $match: { userId: userObjectId } },
      { $group: { _id: "$platform", clicks: { $sum: 1 } } },
      { $project: { _id: 0, platform: "$_id", clicks: 1 } },
      { $sort: { clicks: -1 } },
      { $limit: 3 },
    ]),
    ClickEventModel.aggregate<AggregatedTopLink>([
      { $match: { userId: userObjectId } },
      { $group: { _id: "$linkId", clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: 5 },
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
          shortCode: "$link.shortCode",
          clicks: 1,
        },
      },
    ]),
    ClickEventModel.aggregate<RecentClickActivity>([
      { $match: { userId: userObjectId } },
      { $sort: { timestamp: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: LinkModel.collection.name,
          localField: "linkId",
          foreignField: "_id",
          as: "link",
        },
      },
      { $unwind: { path: "$link", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          shortCode: "$link.shortCode",
          timestamp: 1,
          clicks: { $literal: 1 },
        },
      },
    ]),
    LinkModel.aggregate<RecentLinkActivity>([
      { $match: { userId: userObjectId } },
      { $sort: { createdAt: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          shortCode: 1,
          createdAt: 1,
        },
      },
    ]),
  ]);

  const platformSnapshot = aggregatedPlatformStats.map((platformStat) => ({
    platform: platformStat.platform,
    clicks: platformStat.clicks,
    percentage: calculatePercentage(platformStat.clicks, totalClicks),
  }));

  const topPlatform = platformSnapshot[0] ?? null;
  const topLink = aggregatedTopLinks[0]
    ? { shortCode: aggregatedTopLinks[0].shortCode, clicks: aggregatedTopLinks[0].clicks }
    : null;

  const topLinksPreview = aggregatedTopLinks.slice(0, 5).map((topLinkStat) => ({
    shortCode: topLinkStat.shortCode,
    clicks: topLinkStat.clicks,
  }));

  const recentActivity = [
    ...recentClickEvents.map<DashboardActivityItem>((clickEvent) => ({
      type: "click",
      message: `${clickEvent.shortCode ?? "A link"} got ${clickEvent.clicks} click${clickEvent.clicks === 1 ? "" : "s"}`,
      timestamp: clickEvent.timestamp,
    })),
    ...recentCreatedLinks.map<DashboardActivityItem>((linkEvent) => ({
      type: "link_created",
      message: `New link created: ${linkEvent.shortCode ?? "Untitled"}`,
      timestamp: linkEvent.createdAt,
    })),
  ]
    .sort((leftEvent, rightEvent) => rightEvent.timestamp.getTime() - leftEvent.timestamp.getTime())
    .slice(0, 10);

  return {
    totalClicks,
    activeLinks,
    topPlatform,
    topLink,
    platformSnapshot,
    topLinksPreview,
    recentActivity,
    quickInsight: getQuickInsight(topPlatform),
  };
};
