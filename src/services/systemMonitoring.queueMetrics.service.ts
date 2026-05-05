import type { Queue } from "bullmq";

import { QueueMetricModel } from "../api/models/queueMetric.model.js";
import {
  BEHAVIOR_EVENTS_QUEUE_NAME,
  ALERTS_DETECTION_QUEUE_NAME,
  ALERTS_DISPATCH_QUEUE_NAME,
  ATTRIBUTION_QUEUE_NAME,
  AUDIENCE_AGGREGATION_QUEUE_NAME,
  FUNNEL_AGGREGATION_QUEUE_NAME,
  METRICS_AGGREGATION_QUEUE_NAME,
  WEEKLY_REPORTS_QUEUE_NAME,
  ADMIN_FUNNEL_METRICS_AGGREGATION_QUEUE_NAME,
  ADMIN_PLATFORM_METRICS_AGGREGATION_QUEUE_NAME,
  ADMIN_USAGE_METRICS_AGGREGATION_QUEUE_NAME,
  getAlertsDetectionQueue,
  getAlertsDispatchQueue,
  getAttributionQueue,
  getAudienceAggregationQueue,
  getBehaviorEventsQueue,
  getFunnelAggregationQueue,
  getMetricsAggregationQueue,
  getWeeklyReportsQueue,
  getAdminFunnelMetricsAggregationQueue,
  getAdminPlatformMetricsAggregationQueue,
  getAdminUsageMetricsAggregationQueue,
} from "../infrastructure/queue.js";

type QueueRegistryEntry = {
  queueName: string;
  getQueue: () => Queue;
};

const queueRegistry: QueueRegistryEntry[] = [
  { queueName: BEHAVIOR_EVENTS_QUEUE_NAME, getQueue: getBehaviorEventsQueue },
  { queueName: METRICS_AGGREGATION_QUEUE_NAME, getQueue: getMetricsAggregationQueue },
  { queueName: FUNNEL_AGGREGATION_QUEUE_NAME, getQueue: getFunnelAggregationQueue },
  { queueName: WEEKLY_REPORTS_QUEUE_NAME, getQueue: getWeeklyReportsQueue },
  { queueName: ATTRIBUTION_QUEUE_NAME, getQueue: getAttributionQueue },
  { queueName: AUDIENCE_AGGREGATION_QUEUE_NAME, getQueue: getAudienceAggregationQueue },
  { queueName: ALERTS_DETECTION_QUEUE_NAME, getQueue: getAlertsDetectionQueue },
  { queueName: ALERTS_DISPATCH_QUEUE_NAME, getQueue: getAlertsDispatchQueue },
  {
    queueName: ADMIN_PLATFORM_METRICS_AGGREGATION_QUEUE_NAME,
    getQueue: getAdminPlatformMetricsAggregationQueue,
  },
  {
    queueName: ADMIN_USAGE_METRICS_AGGREGATION_QUEUE_NAME,
    getQueue: getAdminUsageMetricsAggregationQueue,
  },
  {
    queueName: ADMIN_FUNNEL_METRICS_AGGREGATION_QUEUE_NAME,
    getQueue: getAdminFunnelMetricsAggregationQueue,
  },
];

type QueueSnapshot = {
  completedCount: number;
  timestampMs: number;
};

const previousQueueSnapshotsByQueueName = new Map<string, QueueSnapshot>();

export const collectQueueMetricsSnapshot = async (): Promise<void> => {
  const nowDate = new Date();
  const nowTimestampMs = nowDate.getTime();

  await Promise.all(
    queueRegistry.map(async (entry) => {
      const queue = entry.getQueue();
      const [jobCounts, completedCount] = await Promise.all([
        queue.getJobCounts("waiting", "active", "failed"),
        queue.getCompletedCount(),
      ]);

      const previousSnapshot = previousQueueSnapshotsByQueueName.get(entry.queueName);
      const elapsedSeconds = previousSnapshot
        ? Math.max((nowTimestampMs - previousSnapshot.timestampMs) / 1000, 1)
        : 1;
      const throughputPerSecond = previousSnapshot
        ? Math.max((completedCount - previousSnapshot.completedCount) / elapsedSeconds, 0)
        : 0;

      previousQueueSnapshotsByQueueName.set(entry.queueName, {
        completedCount,
        timestampMs: nowTimestampMs,
      });

      await QueueMetricModel.updateOne(
        {
          queueName: entry.queueName,
          timestamp: nowDate,
        },
        {
          $set: {
            queueName: entry.queueName,
            pendingJobs: jobCounts.waiting ?? 0,
            processingJobs: jobCounts.active ?? 0,
            failedJobs: jobCounts.failed ?? 0,
            throughputPerSecond,
            timestamp: nowDate,
          },
        },
        { upsert: true },
      ).exec();
    }),
  );
};
