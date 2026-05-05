import { Types } from "mongoose";

import { BehaviorEventModel } from "../api/models/behaviorEvent.model.js";
import { ClickEventModel } from "../api/models/clickEvent.model.js";
import { LinkModel } from "../api/models/link.model.js";
import {
  type AccountStatus,
  type SubscriptionType,
  UserModel,
} from "../api/models/user.model.js";

type AdminUserListFilters = {
  page: number;
  limit: number;
  search?: string;
  status?: AccountStatus;
  plan?: SubscriptionType;
};

export type AdminUserListItem = {
  _id: string;
  email: string;
  name: string;
  plan: SubscriptionType;
  status: AccountStatus;
  createdAt: Date;
  stats: {
    totalLinks: number;
    totalClicks: number;
    engagementScore: number;
  };
};

export type AdminUserDetail = {
  _id: string;
  email: string;
  name: string;
  plan: SubscriptionType;
  status: AccountStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
  stats: {
    totalLinks: number;
    totalClicks: number;
    engagementScore: number;
  };
  activity: {
    lastLoginAt: Date | null;
    recentEvents: Array<{
      eventType: string;
      timestamp: Date;
      pageUrl: string;
    }>;
  };
};

type ServiceApiError = Error & { statusCode: number };

const createServiceApiError = (
  message: string,
  statusCode: number,
): ServiceApiError => {
  const apiError = new Error(message) as ServiceApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

const escapeRegularExpression = (rawValue: string): string =>
  rawValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const calculateEngagementScore = (
  totalClicks: number,
  totalLinks: number,
): number => {
  if (totalClicks <= 0 || totalLinks <= 0) {
    return 0;
  }
  const clicksPerLink = totalClicks / totalLinks;
  return Number(Math.min(100, clicksPerLink).toFixed(2));
};

const toObjectId = (userId: string): Types.ObjectId => new Types.ObjectId(userId);

const resolveUserStats = async (
  userId: string,
): Promise<{
  totalLinks: number;
  totalClicks: number;
  engagementScore: number;
}> => {
  const userObjectId = toObjectId(userId);
  const [totalLinks, totalClicks] = await Promise.all([
    LinkModel.countDocuments({ userId: userObjectId }),
    ClickEventModel.countDocuments({ userId: userObjectId }),
  ]);

  return {
    totalLinks,
    totalClicks,
    engagementScore: calculateEngagementScore(totalClicks, totalLinks),
  };
};

export const listAdminUsers = async (
  filters: AdminUserListFilters,
): Promise<{
  users: AdminUserListItem[];
  pagination: { total: number; page: number; limit: number };
}> => {
  const skip = (filters.page - 1) * filters.limit;
  const baseQuery: {
    isDeleted: boolean;
    accountStatus?: AccountStatus;
    subscription?: SubscriptionType;
    $or?: Array<{ email?: { $regex: string; $options: string }; fullName?: { $regex: string; $options: string } }>;
  } = {
    isDeleted: false,
  };

  if (filters.status) {
    baseQuery.accountStatus = filters.status;
  }
  if (filters.plan) {
    baseQuery.subscription = filters.plan;
  }
  if (filters.search) {
    const safeSearchPattern = escapeRegularExpression(filters.search);
    baseQuery.$or = [
      { email: { $regex: safeSearchPattern, $options: "i" } },
      { fullName: { $regex: safeSearchPattern, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    UserModel.find(baseQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filters.limit)
      .select("email fullName subscription accountStatus createdAt")
      .lean(),
    UserModel.countDocuments(baseQuery),
  ]);

  const usersWithStats = await Promise.all(
    users.map(async (user) => ({
      _id: user._id.toString(),
      email: user.email,
      name: user.fullName,
      plan: user.subscription,
      status: user.accountStatus ?? "active",
      createdAt: user.createdAt,
      stats: await resolveUserStats(user._id.toString()),
    })),
  );

  return {
    users: usersWithStats,
    pagination: {
      total,
      page: filters.page,
      limit: filters.limit,
    },
  };
};

export const getAdminUserDetail = async (
  userId: string,
): Promise<AdminUserDetail | null> => {
  const userObjectId = toObjectId(userId);
  const user = await UserModel.findOne({
    _id: userObjectId,
    isDeleted: false,
  })
    .select(
      "email fullName subscription accountStatus createdAt lastLoginAt userType",
    )
    .lean();

  if (!user) {
    return null;
  }

  const [stats, recentBehaviorEvents] = await Promise.all([
    resolveUserStats(userId),
    BehaviorEventModel.find({ userId: userObjectId })
      .sort({ timestamp: -1 })
      .limit(10)
      .select("eventType timestamp page.url")
      .lean(),
  ]);

  return {
    _id: user._id.toString(),
    email: user.email,
    name: user.fullName,
    plan: user.subscription,
    status: user.accountStatus ?? "active",
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null,
    stats,
    activity: {
      lastLoginAt: user.lastLoginAt ?? null,
      recentEvents: recentBehaviorEvents.map((event) => ({
        eventType: event.eventType,
        timestamp: event.timestamp,
        pageUrl: event.page?.url ?? "",
      })),
    },
  };
};

export const updateAdminUserStatus = async (
  currentAdminUserId: string,
  targetUserId: string,
  status: AccountStatus,
): Promise<void> => {
  if (currentAdminUserId === targetUserId && status === "suspended") {
    throw createServiceApiError("You cannot suspend your own account", 400);
  }

  const targetUser = await UserModel.findOne({
    _id: toObjectId(targetUserId),
    isDeleted: false,
  });

  if (!targetUser) {
    throw createServiceApiError("User not found", 404);
  }

  if (targetUser.userType === "superadmin" && status === "suspended") {
    throw createServiceApiError("Suspending superadmin users is not allowed", 403);
  }

  targetUser.accountStatus = status;
  await targetUser.save();
};

export const updateAdminUserPlan = async (
  targetUserId: string,
  plan: SubscriptionType,
): Promise<void> => {
  const targetUser = await UserModel.findOne({
    _id: toObjectId(targetUserId),
    isDeleted: false,
  });

  if (!targetUser) {
    throw createServiceApiError("User not found", 404);
  }

  targetUser.subscription = plan;
  await targetUser.save();
};

