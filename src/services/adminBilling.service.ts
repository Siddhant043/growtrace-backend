import { Types, type PipelineStage } from "mongoose";

import { PaymentModel, type PaymentStatus } from "../api/models/payment.model.js";
import { SubscriptionModel } from "../api/models/subscription.model.js";
import { UserModel } from "../api/models/user.model.js";

type ServiceApiError = Error & { statusCode: number };

const createServiceApiError = (
  message: string,
  statusCode: number,
): ServiceApiError => {
  const apiError = new Error(message) as ServiceApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

const toObjectId = (value: string): Types.ObjectId => new Types.ObjectId(value);

const escapeRegularExpression = (rawValue: string): string =>
  rawValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type ListAdminSubscriptionsFilters = {
  page: number;
  limit: number;
  status?: "active" | "cancelled" | "expired";
  search?: string;
  sortBy?: "createdAt" | "currentPeriodEnd" | "status";
  sortOrder?: "asc" | "desc";
};

export type ListAdminPaymentsFilters = {
  page: number;
  limit: number;
  status?: PaymentStatus;
  userId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: "createdAt" | "amount" | "status";
  sortOrder?: "asc" | "desc";
};

export type AdminSubscriptionListItem = {
  _id: string;
  user: { _id: string; email: string };
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
  createdAt: Date;
};

export type AdminPaymentListItem = {
  _id: string;
  user: { _id: string; email: string };
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  failureReason: string | null;
  createdAt: Date;
};

const resolveDateRangeFilter = (
  fromDate?: string,
  toDate?: string,
): { $gte?: Date; $lte?: Date } | undefined => {
  const dateFilter: { $gte?: Date; $lte?: Date } = {};
  if (fromDate) {
    dateFilter.$gte = new Date(fromDate);
  }
  if (toDate) {
    dateFilter.$lte = new Date(toDate);
  }
  return Object.keys(dateFilter).length > 0 ? dateFilter : undefined;
};

export const listAdminSubscriptions = async (
  filters: ListAdminSubscriptionsFilters,
): Promise<{
  subscriptions: AdminSubscriptionListItem[];
  pagination: { total: number; page: number; limit: number };
}> => {
  const skip = (filters.page - 1) * filters.limit;
  const sortDirection = filters.sortOrder === "asc" ? 1 : -1;

  const pipeline: PipelineStage[] = [
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $match: {
        "user.isDeleted": false,
      },
    },
  ];

  if (filters.status) {
    pipeline.push({ $match: { status: filters.status } });
  }

  if (filters.search) {
    const safePattern = escapeRegularExpression(filters.search);
    const searchClauses: Array<Record<string, unknown>> = [
      { "user.email": { $regex: safePattern, $options: "i" } },
    ];
    const searchLooksLikeObjectId = Types.ObjectId.isValid(filters.search);
    if (searchLooksLikeObjectId) {
      searchClauses.push({ userId: new Types.ObjectId(filters.search) });
    }
    pipeline.push({
      $match: {
        $or: searchClauses,
      },
    });
  }

  const subscriptionsSort: Record<string, 1 | -1> = {};
  if (filters.sortBy === "status") {
    subscriptionsSort.status = sortDirection;
    subscriptionsSort.createdAt = -1;
  } else if (filters.sortBy === "currentPeriodEnd") {
    subscriptionsSort.currentEnd = sortDirection;
    subscriptionsSort.createdAt = -1;
  } else {
    subscriptionsSort.createdAt = sortDirection;
  }

  pipeline.push(
    { $sort: subscriptionsSort },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: filters.limit },
          {
            $project: {
              _id: 1,
              plan: 1,
              status: 1,
              createdAt: 1,
              currentPeriodEnd: "$currentEnd",
              user: {
                _id: "$user._id",
                email: "$user.email",
              },
            },
          },
        ],
        totalCount: [{ $count: "count" }],
      },
    },
  );

  const aggregateResult = await SubscriptionModel.aggregate<{
    data: Array<{
      _id: Types.ObjectId;
      plan: string;
      status: string;
      currentPeriodEnd: Date | null;
      createdAt: Date;
      user: { _id: Types.ObjectId; email: string };
    }>;
    totalCount: Array<{ count: number }>;
  }>(pipeline);

  const firstResult = aggregateResult[0];
  const total = firstResult?.totalCount[0]?.count ?? 0;
  const subscriptions =
    firstResult?.data.map((subscription) => ({
      _id: subscription._id.toString(),
      user: {
        _id: subscription.user._id.toString(),
        email: subscription.user.email,
      },
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      createdAt: subscription.createdAt,
    })) ?? [];

  return {
    subscriptions,
    pagination: {
      total,
      page: filters.page,
      limit: filters.limit,
    },
  };
};

export const getAdminSubscriptionDetails = async (
  subscriptionId: string,
): Promise<{
  _id: string;
  user: { _id: string; email: string };
  plan: string;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  payments: Array<{
    _id: string;
    amount: number;
    status: PaymentStatus;
    method: string | null;
    failureReason: string | null;
    createdAt: Date;
  }>;
} | null> => {
  const subscription = await SubscriptionModel.findById(toObjectId(subscriptionId))
    .select("userId plan status currentStart currentEnd")
    .lean();
  if (!subscription) {
    return null;
  }

  const user = await UserModel.findOne({ _id: subscription.userId, isDeleted: false })
    .select("email")
    .lean();
  if (!user) {
    throw createServiceApiError("Subscription user not found", 404);
  }

  const payments = await PaymentModel.find({
    subscriptionId: subscription._id,
  })
    .sort({ createdAt: -1 })
    .select("amount status method failureReason createdAt")
    .lean();

  return {
    _id: subscription._id.toString(),
    user: {
      _id: subscription.userId.toString(),
      email: user.email,
    },
    plan: subscription.plan,
    status: subscription.status,
    currentPeriodStart: subscription.currentStart ?? null,
    currentPeriodEnd: subscription.currentEnd ?? null,
    payments: payments.map((payment) => ({
      _id: payment._id.toString(),
      amount: payment.amount,
      status: payment.status,
      method: payment.method ?? null,
      failureReason: payment.failureReason ?? null,
      createdAt: payment.createdAt,
    })),
  };
};

const listAdminPaymentsByStatus = async (
  filters: ListAdminPaymentsFilters,
  forcedStatus?: PaymentStatus,
): Promise<{
  payments: AdminPaymentListItem[];
  pagination: { total: number; page: number; limit: number };
}> => {
  const skip = (filters.page - 1) * filters.limit;
  const dateRangeFilter = resolveDateRangeFilter(filters.fromDate, filters.toDate);
  const sortDirection = filters.sortOrder === "asc" ? 1 : -1;
  const paymentsSort: Record<string, 1 | -1> = {};
  if (filters.sortBy === "amount") {
    paymentsSort.amount = sortDirection;
    paymentsSort.createdAt = -1;
  } else if (filters.sortBy === "status") {
    paymentsSort.status = sortDirection;
    paymentsSort.createdAt = -1;
  } else {
    paymentsSort.createdAt = sortDirection;
  }

  const paymentQuery: {
    status?: PaymentStatus;
    userId?: Types.ObjectId;
    createdAt?: { $gte?: Date; $lte?: Date };
  } = {};

  if (forcedStatus) {
    paymentQuery.status = forcedStatus;
  } else if (filters.status) {
    paymentQuery.status = filters.status;
  }
  if (filters.userId) {
    paymentQuery.userId = toObjectId(filters.userId);
  }
  if (dateRangeFilter) {
    paymentQuery.createdAt = dateRangeFilter;
  }

  const [payments, total] = await Promise.all([
    PaymentModel.find(paymentQuery)
      .sort(paymentsSort)
      .skip(skip)
      .limit(filters.limit)
      .select("userId amount currency status method failureReason createdAt")
      .lean(),
    PaymentModel.countDocuments(paymentQuery),
  ]);

  const uniqueUserIds = Array.from(
    new Set(payments.map((payment) => payment.userId.toString())),
  );

  const users = await UserModel.find({
    _id: { $in: uniqueUserIds.map((userId) => toObjectId(userId)) },
    isDeleted: false,
  })
    .select("email")
    .lean();
  const userEmailById = new Map(users.map((user) => [user._id.toString(), user.email]));

  return {
    payments: payments.map((payment) => ({
      _id: payment._id.toString(),
      user: {
        _id: payment.userId.toString(),
        email: userEmailById.get(payment.userId.toString()) ?? "Unknown user",
      },
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      method: payment.method ?? null,
      failureReason: payment.failureReason ?? null,
      createdAt: payment.createdAt,
    })),
    pagination: {
      total,
      page: filters.page,
      limit: filters.limit,
    },
  };
};

export const listAdminPayments = async (
  filters: ListAdminPaymentsFilters,
): Promise<{
  payments: AdminPaymentListItem[];
  pagination: { total: number; page: number; limit: number };
}> => listAdminPaymentsByStatus(filters);

export const listFailedAdminPayments = async (
  filters: ListAdminPaymentsFilters,
): Promise<{
  payments: AdminPaymentListItem[];
  pagination: { total: number; page: number; limit: number };
}> => listAdminPaymentsByStatus(filters, "failed");

