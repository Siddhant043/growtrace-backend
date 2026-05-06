import { AdminUsageMetricsDailyModel } from "../api/models/adminUsageMetricsDaily.model.js";
import { AlertModel } from "../api/models/alert.model.js";
import { ClickEventModel } from "../api/models/clickEvent.model.js";
import { ErrorLogModel } from "../api/models/errorLog.model.js";
import { LinkModel } from "../api/models/link.model.js";
import { PaymentModel } from "../api/models/payment.model.js";
import { QueueMetricModel } from "../api/models/queueMetric.model.js";
import { ReportJobModel } from "../api/models/reportJob.model.js";
import { SubscriptionModel } from "../api/models/subscription.model.js";
import { UserModel } from "../api/models/user.model.js";
import { getRedisClient } from "../infrastructure/redis.js";
import { formatDateAsUtcIsoDate } from "../utils/dateBounds.utils.js";

type DashboardDatePoint = {
  date: string;
  users: number;
  clicks: number;
};

type RecentActivityType =
  | "alert"
  | "error"
  | "failed_payment"
  | "report_job";

type DashboardRecentActivityItem = {
  id: string;
  type: RecentActivityType;
  title: string;
  subtitle: string;
  occurredAt: string;
  severity: "info" | "warning" | "critical";
};

type GetAdminDashboardInput = {
  chartStartDate?: string;
  chartEndDate?: string;
  chartPage: number;
  chartLimit: number;
  activityCursor?: string;
  activityLimit: number;
  alertsPage: number;
  alertsLimit: number;
};

type DashboardSummary = {
  totalUsers: number;
  activeUsers: number;
  totalLinks: number;
  totalClicks: number;
  proUsers: number;
  mrr: number;
  currency: string;
  asOf: string;
};

type DashboardResponse = {
  summary: DashboardSummary;
  growthSeries: {
    range: { startDate: string; endDate: string };
    items: DashboardDatePoint[];
  };
  recentActivity: {
    items: DashboardRecentActivityItem[];
    pageInfo: { nextCursor: string | null; limit: number };
  };
  alertsSummary: {
    total: number;
    unread: number;
    countsByType: Record<string, number>;
    recentAlerts: Array<{
      id: string;
      type: string;
      headline: string;
      createdAt: string;
      isRead: boolean;
    }>;
    pagination: { total: number; page: number; limit: number };
  };
  failedJobs: {
    total: number;
    queues: Array<{
      queueName: string;
      failedJobs: number;
      pendingJobs: number;
      processingJobs: number;
      timestamp: string;
    }>;
  };
  pagination: {
    chart: { page: number; limit: number };
    activity: { limit: number; nextCursor: string | null };
    alerts: { page: number; limit: number; total: number };
  };
};

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "authenticated"] as const;
const DASHBOARD_CACHE_TTL_SECONDS = 60;

const createBadRequestError = (message: string): Error & { statusCode: number } => {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 400;
  return error;
};

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const resolveChartDateRange = (
  chartStartDate?: string,
  chartEndDate?: string,
): { startDate: string; endDate: string } => {
  if (!chartStartDate && !chartEndDate) {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 29);
    return {
      startDate: formatDateAsUtcIsoDate(startDate),
      endDate: formatDateAsUtcIsoDate(endDate),
    };
  }

  if (!chartStartDate || !chartEndDate) {
    throw createBadRequestError(
      "chartStartDate and chartEndDate must be provided together",
    );
  }

  if (!isIsoDate(chartStartDate) || !isIsoDate(chartEndDate)) {
    throw createBadRequestError("chartStartDate/chartEndDate must be YYYY-MM-DD");
  }

  if (chartStartDate > chartEndDate) {
    throw createBadRequestError("chartStartDate cannot be later than chartEndDate");
  }

  return { startDate: chartStartDate, endDate: chartEndDate };
};

const computeMrr = async (): Promise<{ value: number; currency: string }> => {
  const rows = await SubscriptionModel.aggregate<{
    _id: string;
    monthlyRevenue: number;
    yearlyRevenue: number;
    currency: string;
  }>([
    {
      $match: {
        status: { $in: [...ACTIVE_SUBSCRIPTION_STATUSES] },
      },
    },
    {
      $lookup: {
        from: "payments",
        let: { localSubscriptionId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$subscriptionId", "$$localSubscriptionId"] },
                  { $eq: ["$status", "success"] },
                ],
              },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          { $project: { amount: 1, currency: 1 } },
        ],
        as: "latestPayment",
      },
    },
    { $unwind: "$latestPayment" },
    {
      $group: {
        _id: "$latestPayment.currency",
        monthlyRevenue: {
          $sum: {
            $cond: [
              { $eq: ["$billingInterval", "monthly"] },
              "$latestPayment.amount",
              0,
            ],
          },
        },
        yearlyRevenue: {
          $sum: {
            $cond: [
              { $eq: ["$billingInterval", "yearly"] },
              "$latestPayment.amount",
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        currency: "$_id",
        monthlyRevenue: 1,
        yearlyRevenue: 1,
      },
    },
    { $sort: { monthlyRevenue: -1, yearlyRevenue: -1 } },
  ]);

  if (rows.length === 0) {
    return { value: 0, currency: "INR" };
  }

  const primaryCurrencyRow = rows[0];
  const mrr = primaryCurrencyRow.monthlyRevenue + primaryCurrencyRow.yearlyRevenue / 12;
  return { value: Number(mrr.toFixed(2)), currency: primaryCurrencyRow.currency };
};

const getFailedJobsSummary = async (): Promise<DashboardResponse["failedJobs"]> => {
  const queueRows = await QueueMetricModel.aggregate<{
    queueName: string;
    pendingJobs: number;
    processingJobs: number;
    failedJobs: number;
    timestamp: Date;
  }>([
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: "$queueName",
        queueName: { $first: "$queueName" },
        pendingJobs: { $first: "$pendingJobs" },
        processingJobs: { $first: "$processingJobs" },
        failedJobs: { $first: "$failedJobs" },
        timestamp: { $first: "$timestamp" },
      },
    },
    { $sort: { queueName: 1 } },
  ]);

  return {
    total: queueRows.reduce((sum, row) => sum + row.failedJobs, 0),
    queues: queueRows.map((row) => ({
      queueName: row.queueName,
      failedJobs: row.failedJobs,
      pendingJobs: row.pendingJobs,
      processingJobs: row.processingJobs,
      timestamp: row.timestamp.toISOString(),
    })),
  };
};

const getRecentActivity = async (
  activityLimit: number,
  activityCursor?: string,
): Promise<DashboardResponse["recentActivity"]> => {
  const cursorDate = activityCursor ? new Date(activityCursor) : undefined;
  const createdAtFilter = cursorDate
    ? {
        createdAt: { $lt: cursorDate },
      }
    : {};

  const [alerts, errors, failedPayments, reportJobs] = await Promise.all([
    AlertModel.find(createdAtFilter)
      .sort({ createdAt: -1 })
      .limit(activityLimit)
      .select("type headline createdAt")
      .lean(),
    ErrorLogModel.find(createdAtFilter)
      .sort({ createdAt: -1 })
      .limit(activityLimit)
      .select("service message severity createdAt")
      .lean(),
    PaymentModel.find({
      ...createdAtFilter,
      status: "failed",
    })
      .sort({ createdAt: -1 })
      .limit(activityLimit)
      .select("failureReason createdAt")
      .lean(),
    ReportJobModel.find(createdAtFilter)
      .sort({ createdAt: -1 })
      .limit(activityLimit)
      .select("status error createdAt")
      .lean(),
  ]);

  const activityItems: DashboardRecentActivityItem[] = [
    ...alerts.map((alert) => ({
      id: alert._id.toString(),
      type: "alert" as const,
      title: alert.headline,
      subtitle: `Alert type: ${alert.type}`,
      occurredAt: alert.createdAt.toISOString(),
      severity: "warning" as const,
    })),
    ...errors.map((error) => ({
      id: error._id.toString(),
      type: "error" as const,
      title: error.message,
      subtitle: `Service: ${error.service}`,
      occurredAt: error.createdAt.toISOString(),
      severity: error.severity === "high" ? ("critical" as const) : ("warning" as const),
    })),
    ...failedPayments.map((payment) => ({
      id: payment._id.toString(),
      type: "failed_payment" as const,
      title: "Payment failed",
      subtitle: payment.failureReason ?? "No failure reason provided",
      occurredAt: payment.createdAt.toISOString(),
      severity: "warning" as const,
    })),
    ...reportJobs.map((reportJob) => ({
      id: reportJob._id.toString(),
      type: "report_job" as const,
      title:
        reportJob.status === "failed"
          ? "Weekly report job failed"
          : `Report job ${reportJob.status}`,
      subtitle: reportJob.error?.message ?? "Report job status update",
      occurredAt: reportJob.createdAt.toISOString(),
      severity: reportJob.status === "failed" ? ("critical" as const) : ("info" as const),
    })),
  ]
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    )
    .slice(0, activityLimit);

  const lastItem = activityItems[activityItems.length - 1];

  return {
    items: activityItems,
    pageInfo: {
      nextCursor: lastItem?.occurredAt ?? null,
      limit: activityLimit,
    },
  };
};

const getAlertsSummary = async (
  alertsPage: number,
  alertsLimit: number,
): Promise<DashboardResponse["alertsSummary"]> => {
  const skip = (alertsPage - 1) * alertsLimit;

  const [total, unread, groupedRows, recentAlerts] = await Promise.all([
    AlertModel.countDocuments({}),
    AlertModel.countDocuments({ isRead: false }),
    AlertModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
    AlertModel.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(alertsLimit)
      .select("type headline createdAt isRead")
      .lean(),
  ]);

  const countsByType = groupedRows.reduce<Record<string, number>>((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

  return {
    total,
    unread,
    countsByType,
    recentAlerts: recentAlerts.map((alert) => ({
      id: alert._id.toString(),
      type: alert.type,
      headline: alert.headline,
      createdAt: alert.createdAt.toISOString(),
      isRead: alert.isRead,
    })),
    pagination: {
      total,
      page: alertsPage,
      limit: alertsLimit,
    },
  };
};

const getSummary = async (): Promise<DashboardSummary> => {
  const todayIsoDate = formatDateAsUtcIsoDate(new Date());

  const [totalUsers, totalLinks, proUsers, clicksAggregationRows, todayUsage, mrr] =
    await Promise.all([
      UserModel.countDocuments({ isDeleted: false }),
      LinkModel.countDocuments({}),
      UserModel.countDocuments({ isDeleted: false, subscription: "pro" }),
      AdminUsageMetricsDailyModel.aggregate<{ _id: null; totalClicks: number }>([
        { $group: { _id: null, totalClicks: { $sum: "$totalClicks" } } },
      ]),
      AdminUsageMetricsDailyModel.findOne({ date: todayIsoDate })
        .select("activeUsers")
        .lean(),
      computeMrr(),
    ]);

  const totalClicks = clicksAggregationRows[0]?.totalClicks ?? 0;
  const activeUsers = todayUsage?.activeUsers ?? 0;

  return {
    totalUsers,
    activeUsers,
    totalLinks,
    totalClicks,
    proUsers,
    mrr: mrr.value,
    currency: mrr.currency,
    asOf: new Date().toISOString(),
  };
};

const getGrowthSeries = async (
  startDate: string,
  endDate: string,
  chartPage: number,
  chartLimit: number,
): Promise<DashboardResponse["growthSeries"]> => {
  const skip = (chartPage - 1) * chartLimit;
  const usageRows = await AdminUsageMetricsDailyModel.find({
    date: { $gte: startDate, $lte: endDate },
  })
    .sort({ date: -1 })
    .skip(skip)
    .limit(chartLimit)
    .select("date newUsers totalClicks")
    .lean();

  const items = usageRows
    .map<DashboardDatePoint>((usageRow) => ({
      date: usageRow.date,
      users: usageRow.newUsers,
      clicks: usageRow.totalClicks,
    }))
    .reverse();

  return {
    range: { startDate, endDate },
    items,
  };
};

const buildDashboardCacheKey = (input: GetAdminDashboardInput): string =>
  [
    "admin-dashboard",
    `chartStartDate=${input.chartStartDate ?? ""}`,
    `chartEndDate=${input.chartEndDate ?? ""}`,
    `chartPage=${input.chartPage}`,
    `chartLimit=${input.chartLimit}`,
    `activityCursor=${input.activityCursor ?? ""}`,
    `activityLimit=${input.activityLimit}`,
    `alertsPage=${input.alertsPage}`,
    `alertsLimit=${input.alertsLimit}`,
  ].join("|");

const getCachedResponse = async (cacheKey: string): Promise<DashboardResponse | null> => {
  try {
    const redisClient = getRedisClient();
    const cachedPayload = await redisClient.get(cacheKey);
    if (!cachedPayload) {
      return null;
    }
    return JSON.parse(cachedPayload) as DashboardResponse;
  } catch (error) {
    console.warn("[adminDashboard.service] cache read failed", error);
    return null;
  }
};

const setCachedResponse = async (
  cacheKey: string,
  responsePayload: DashboardResponse,
): Promise<void> => {
  try {
    const redisClient = getRedisClient();
    await redisClient.set(
      cacheKey,
      JSON.stringify(responsePayload),
      "EX",
      DASHBOARD_CACHE_TTL_SECONDS,
    );
  } catch (error) {
    console.warn("[adminDashboard.service] cache write failed", error);
  }
};

export const getAdminDashboard = async (
  input: GetAdminDashboardInput,
): Promise<DashboardResponse> => {
  const resolvedRange = resolveChartDateRange(
    input.chartStartDate,
    input.chartEndDate,
  );
  const normalizedInput: GetAdminDashboardInput = {
    ...input,
    chartStartDate: resolvedRange.startDate,
    chartEndDate: resolvedRange.endDate,
  };

  const cacheKey = buildDashboardCacheKey(normalizedInput);
  const cachedResponse = await getCachedResponse(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  const [summary, growthSeries, recentActivity, alertsSummary, failedJobs] =
    await Promise.all([
      getSummary(),
      getGrowthSeries(
        resolvedRange.startDate,
        resolvedRange.endDate,
        input.chartPage,
        input.chartLimit,
      ),
      getRecentActivity(input.activityLimit, input.activityCursor),
      getAlertsSummary(input.alertsPage, input.alertsLimit),
      getFailedJobsSummary(),
    ]);

  const responsePayload: DashboardResponse = {
    summary,
    growthSeries,
    recentActivity,
    alertsSummary,
    failedJobs,
    pagination: {
      chart: { page: input.chartPage, limit: input.chartLimit },
      activity: {
        limit: input.activityLimit,
        nextCursor: recentActivity.pageInfo.nextCursor,
      },
      alerts: {
        page: input.alertsPage,
        limit: input.alertsLimit,
        total: alertsSummary.pagination.total,
      },
    },
  };

  await setCachedResponse(cacheKey, responsePayload);
  return responsePayload;
};
