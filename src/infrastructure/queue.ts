import { Queue, Worker, type Processor, type WorkerOptions } from "bullmq";
import IORedis, { type Redis } from "ioredis";

import { env } from "../config/env.js";

export const BEHAVIOR_EVENTS_QUEUE_NAME = "behaviorEvents";
export const METRICS_AGGREGATION_QUEUE_NAME = "metricsAggregation";
export const FUNNEL_AGGREGATION_QUEUE_NAME = "funnelAggregation";
export const WEEKLY_REPORTS_QUEUE_NAME = "weekly-reports";
export const ATTRIBUTION_QUEUE_NAME = "attribution";
export const ATTRIBUTION_TOUCHPOINT_JOB_NAME = "ingest-touchpoint";
export const AUDIENCE_AGGREGATION_QUEUE_NAME = "audienceAggregation";
export const ALERTS_DETECTION_QUEUE_NAME = "alertsDetection";
export const ALERTS_DISPATCH_QUEUE_NAME = "alertsDispatch";

export const WEEKLY_REPORTS_PRODUCER_JOB_NAME = "produce-weekly-reports";
export const WEEKLY_REPORTS_USER_JOB_NAME = "generate-user-weekly-report";
export const WEEKLY_REPORTS_PRODUCER_SCHEDULER_ID =
  "weekly-reports-producer-cron";

export const METRICS_AGGREGATION_SCHEDULER_IDS = {
  currentUtcDay: "recompute-current-utc-day",
  previousUtcDay: "recompute-previous-utc-day",
} as const;

export const FUNNEL_AGGREGATION_SCHEDULER_IDS = {
  currentUtcDay: "recompute-current-utc-day-funnel",
  previousUtcDay: "recompute-previous-utc-day-funnel",
} as const;

export type MetricsAggregationSchedulerId =
  (typeof METRICS_AGGREGATION_SCHEDULER_IDS)[keyof typeof METRICS_AGGREGATION_SCHEDULER_IDS];

export type FunnelAggregationSchedulerId =
  (typeof FUNNEL_AGGREGATION_SCHEDULER_IDS)[keyof typeof FUNNEL_AGGREGATION_SCHEDULER_IDS];

export interface MetricsAggregationJobPayload {
  schedulerId: MetricsAggregationSchedulerId;
}

export interface FunnelAggregationJobPayload {
  schedulerId: FunnelAggregationSchedulerId;
}

export interface BehaviorEventJobPayload {
  apiKey: string;
  userId: string;
  linkId: string | null;
  sessionId: string;
  userTrackingId: string | null;
  eventType: string;
  clientTimestamp: number;
  page: {
    url: string;
    referrer: string;
  };
  device: {
    userAgent: string;
    screen: string;
  };
  metrics: {
    scrollDepth?: number | null;
    duration?: number | null;
  };
  isReturning: boolean;
  ipAddress: string | null;
  country: string;
  userAgentHeader: string;
  receivedAt: number;
  firstClickAtMs?: number;
}

let bullmqRedisConnection: Redis | null = null;

const getBullmqRedisConnection = (): Redis => {
  if (bullmqRedisConnection) {
    return bullmqRedisConnection;
  }

  bullmqRedisConnection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  return bullmqRedisConnection;
};

let cachedBehaviorEventsQueue: Queue<BehaviorEventJobPayload> | null = null;

export const getBehaviorEventsQueue = (): Queue<BehaviorEventJobPayload> => {
  if (cachedBehaviorEventsQueue) {
    return cachedBehaviorEventsQueue;
  }

  cachedBehaviorEventsQueue = new Queue<BehaviorEventJobPayload>(
    BEHAVIOR_EVENTS_QUEUE_NAME,
    {
      connection: getBullmqRedisConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 500 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400 },
      },
    },
  );

  return cachedBehaviorEventsQueue;
};

export const enqueueBehaviorEvent = async (
  jobPayload: BehaviorEventJobPayload,
): Promise<void> => {
  const queue = getBehaviorEventsQueue();
  await queue.add("behaviorEvent", jobPayload);
};

export const createBehaviorEventsWorker = (
  processor: Processor<BehaviorEventJobPayload>,
  workerOptions: Omit<WorkerOptions, "connection"> = {},
): Worker<BehaviorEventJobPayload> => {
  return new Worker<BehaviorEventJobPayload>(
    BEHAVIOR_EVENTS_QUEUE_NAME,
    processor,
    {
      connection: getBullmqRedisConnection(),
      concurrency: workerOptions.concurrency ?? 4,
      ...workerOptions,
    },
  );
};

let cachedMetricsAggregationQueue: Queue<MetricsAggregationJobPayload> | null =
  null;

export const getMetricsAggregationQueue =
  (): Queue<MetricsAggregationJobPayload> => {
    if (cachedMetricsAggregationQueue) {
      return cachedMetricsAggregationQueue;
    }

    cachedMetricsAggregationQueue = new Queue<MetricsAggregationJobPayload>(
      METRICS_AGGREGATION_QUEUE_NAME,
      {
        connection: getBullmqRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: { age: 3600, count: 200 },
          removeOnFail: { age: 86400 },
        },
      },
    );

    return cachedMetricsAggregationQueue;
  };

export const createMetricsAggregationWorker = (
  processor: Processor<MetricsAggregationJobPayload>,
  workerOptions: Omit<WorkerOptions, "connection"> = {},
): Worker<MetricsAggregationJobPayload> => {
  return new Worker<MetricsAggregationJobPayload>(
    METRICS_AGGREGATION_QUEUE_NAME,
    processor,
    {
      connection: getBullmqRedisConnection(),
      concurrency: workerOptions.concurrency ?? 1,
      ...workerOptions,
    },
  );
};

const METRICS_AGGREGATION_RECURRING_PATTERN = "*/5 * * * *";

export const scheduleRecurringMetricsAggregation = async (): Promise<void> => {
  const metricsQueue = getMetricsAggregationQueue();

  await Promise.all([
    metricsQueue.upsertJobScheduler(
      METRICS_AGGREGATION_SCHEDULER_IDS.currentUtcDay,
      { pattern: METRICS_AGGREGATION_RECURRING_PATTERN },
      {
        name: METRICS_AGGREGATION_SCHEDULER_IDS.currentUtcDay,
        data: {
          schedulerId: METRICS_AGGREGATION_SCHEDULER_IDS.currentUtcDay,
        },
      },
    ),
    metricsQueue.upsertJobScheduler(
      METRICS_AGGREGATION_SCHEDULER_IDS.previousUtcDay,
      { pattern: METRICS_AGGREGATION_RECURRING_PATTERN },
      {
        name: METRICS_AGGREGATION_SCHEDULER_IDS.previousUtcDay,
        data: {
          schedulerId: METRICS_AGGREGATION_SCHEDULER_IDS.previousUtcDay,
        },
      },
    ),
  ]);
};

let cachedFunnelAggregationQueue: Queue<FunnelAggregationJobPayload> | null =
  null;

export const getFunnelAggregationQueue =
  (): Queue<FunnelAggregationJobPayload> => {
    if (cachedFunnelAggregationQueue) {
      return cachedFunnelAggregationQueue;
    }

    cachedFunnelAggregationQueue = new Queue<FunnelAggregationJobPayload>(
      FUNNEL_AGGREGATION_QUEUE_NAME,
      {
        connection: getBullmqRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: { age: 3600, count: 200 },
          removeOnFail: { age: 86400 },
        },
      },
    );

    return cachedFunnelAggregationQueue;
  };

export const createFunnelAggregationWorker = (
  processor: Processor<FunnelAggregationJobPayload>,
  workerOptions: Omit<WorkerOptions, "connection"> = {},
): Worker<FunnelAggregationJobPayload> => {
  return new Worker<FunnelAggregationJobPayload>(
    FUNNEL_AGGREGATION_QUEUE_NAME,
    processor,
    {
      connection: getBullmqRedisConnection(),
      concurrency: workerOptions.concurrency ?? 1,
      ...workerOptions,
    },
  );
};

const FUNNEL_AGGREGATION_RECURRING_PATTERN = "*/5 * * * *";

export interface WeeklyReportsProducerJobPayload {
  reason: "cron" | "manual";
  targetWeekEndDateIso?: string;
}

export interface WeeklyReportsUserJobPayload {
  userId: string;
  weekStartIso: string;
  weekEndIso: string;
  reason: "cron" | "manual";
}

export type WeeklyReportsJobPayload =
  | WeeklyReportsProducerJobPayload
  | WeeklyReportsUserJobPayload;

let cachedWeeklyReportsQueue: Queue<WeeklyReportsJobPayload> | null = null;

export const getWeeklyReportsQueue = (): Queue<WeeklyReportsJobPayload> => {
  if (cachedWeeklyReportsQueue) {
    return cachedWeeklyReportsQueue;
  }

  cachedWeeklyReportsQueue = new Queue<WeeklyReportsJobPayload>(
    WEEKLY_REPORTS_QUEUE_NAME,
    {
      connection: getBullmqRedisConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 60_000 },
        removeOnComplete: { age: 60 * 60 * 24 * 7, count: 5000 },
        removeOnFail: { age: 60 * 60 * 24 * 30 },
      },
    },
  );

  return cachedWeeklyReportsQueue;
};

export const createWeeklyReportsWorker = (
  processor: Processor<WeeklyReportsJobPayload>,
  workerOptions: Omit<WorkerOptions, "connection"> = {},
): Worker<WeeklyReportsJobPayload> => {
  return new Worker<WeeklyReportsJobPayload>(
    WEEKLY_REPORTS_QUEUE_NAME,
    processor,
    {
      connection: getBullmqRedisConnection(),
      concurrency: workerOptions.concurrency ?? 5,
      ...workerOptions,
    },
  );
};

const DEFAULT_WEEKLY_REPORTS_RECURRING_PATTERN = "0 2 * * 0";

export const scheduleRecurringWeeklyReportsProducer = async (
  cronPattern: string = DEFAULT_WEEKLY_REPORTS_RECURRING_PATTERN,
): Promise<void> => {
  const weeklyReportsQueue = getWeeklyReportsQueue();

  await weeklyReportsQueue.upsertJobScheduler(
    WEEKLY_REPORTS_PRODUCER_SCHEDULER_ID,
    { pattern: cronPattern },
    {
      name: WEEKLY_REPORTS_PRODUCER_JOB_NAME,
      data: { reason: "cron" } satisfies WeeklyReportsProducerJobPayload,
    },
  );
};

export const scheduleRecurringFunnelAggregation = async (): Promise<void> => {
  const funnelQueue = getFunnelAggregationQueue();

  await Promise.all([
    funnelQueue.upsertJobScheduler(
      FUNNEL_AGGREGATION_SCHEDULER_IDS.currentUtcDay,
      { pattern: FUNNEL_AGGREGATION_RECURRING_PATTERN },
      {
        name: FUNNEL_AGGREGATION_SCHEDULER_IDS.currentUtcDay,
        data: {
          schedulerId: FUNNEL_AGGREGATION_SCHEDULER_IDS.currentUtcDay,
        },
      },
    ),
    funnelQueue.upsertJobScheduler(
      FUNNEL_AGGREGATION_SCHEDULER_IDS.previousUtcDay,
      { pattern: FUNNEL_AGGREGATION_RECURRING_PATTERN },
      {
        name: FUNNEL_AGGREGATION_SCHEDULER_IDS.previousUtcDay,
        data: {
          schedulerId: FUNNEL_AGGREGATION_SCHEDULER_IDS.previousUtcDay,
        },
      },
    ),
  ]);
};

export type AttributionTouchpointType =
  | "click"
  | "visit"
  | "engaged"
  | "conversion";

export interface AttributionTouchpointJobPayload {
  userTrackingId: string;
  userId: string;
  sessionId: string | null;
  linkId: string | null;
  platform: string | null;
  campaign: string | null;
  type: AttributionTouchpointType;
  timestampMs: number;
  userAgent?: string | null;
}

let cachedAttributionQueue: Queue<AttributionTouchpointJobPayload> | null = null;

export const getAttributionQueue =
  (): Queue<AttributionTouchpointJobPayload> => {
    if (cachedAttributionQueue) {
      return cachedAttributionQueue;
    }

    cachedAttributionQueue = new Queue<AttributionTouchpointJobPayload>(
      ATTRIBUTION_QUEUE_NAME,
      {
        connection: getBullmqRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: { age: 60 * 60 * 24 * 7, count: 5000 },
          removeOnFail: { age: 60 * 60 * 24 * 30 },
        },
      },
    );

    return cachedAttributionQueue;
  };

export const createAttributionWorker = (
  processor: Processor<AttributionTouchpointJobPayload>,
  workerOptions: Omit<WorkerOptions, "connection"> = {},
): Worker<AttributionTouchpointJobPayload> => {
  return new Worker<AttributionTouchpointJobPayload>(
    ATTRIBUTION_QUEUE_NAME,
    processor,
    {
      connection: getBullmqRedisConnection(),
      concurrency: workerOptions.concurrency ?? 8,
      ...workerOptions,
    },
  );
};

export const AUDIENCE_AGGREGATION_SCHEDULER_IDS = {
  rollup: "audience-aggregation:rollup",
} as const;

export type AudienceAggregationSchedulerId =
  (typeof AUDIENCE_AGGREGATION_SCHEDULER_IDS)[keyof typeof AUDIENCE_AGGREGATION_SCHEDULER_IDS];

export interface AudienceAggregationJobPayload {
  schedulerId: AudienceAggregationSchedulerId;
}

let cachedAudienceAggregationQueue: Queue<AudienceAggregationJobPayload> | null =
  null;

export const getAudienceAggregationQueue =
  (): Queue<AudienceAggregationJobPayload> => {
    if (cachedAudienceAggregationQueue) {
      return cachedAudienceAggregationQueue;
    }

    cachedAudienceAggregationQueue = new Queue<AudienceAggregationJobPayload>(
      AUDIENCE_AGGREGATION_QUEUE_NAME,
      {
        connection: getBullmqRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: { age: 3600, count: 200 },
          removeOnFail: { age: 86400 },
        },
      },
    );

    return cachedAudienceAggregationQueue;
  };

export const createAudienceAggregationWorker = (
  processor: Processor<AudienceAggregationJobPayload>,
  workerOptions: Omit<WorkerOptions, "connection"> = {},
): Worker<AudienceAggregationJobPayload> => {
  return new Worker<AudienceAggregationJobPayload>(
    AUDIENCE_AGGREGATION_QUEUE_NAME,
    processor,
    {
      connection: getBullmqRedisConnection(),
      concurrency:
        workerOptions.concurrency ?? env.AUDIENCE_WORKER_CONCURRENCY,
      ...workerOptions,
    },
  );
};

export const scheduleRecurringAudienceAggregation = async (
  cronPattern: string = env.AUDIENCE_AGGREGATION_CRON,
): Promise<void> => {
  const audienceAggregationQueue = getAudienceAggregationQueue();

  await audienceAggregationQueue.upsertJobScheduler(
    AUDIENCE_AGGREGATION_SCHEDULER_IDS.rollup,
    { pattern: cronPattern },
    {
      name: AUDIENCE_AGGREGATION_SCHEDULER_IDS.rollup,
      data: {
        schedulerId: AUDIENCE_AGGREGATION_SCHEDULER_IDS.rollup,
      },
    },
  );
};

export const ALERTS_DETECTION_SCHEDULER_IDS = {
  hourly: "alerts-detection:hourly",
  dailySummary: "alerts-detection:daily-summary",
} as const;

export type AlertsDetectionSchedulerId =
  (typeof ALERTS_DETECTION_SCHEDULER_IDS)[keyof typeof ALERTS_DETECTION_SCHEDULER_IDS];

export type AlertsDetectionReason =
  | "cron-hourly"
  | "cron-daily"
  | "post-metrics"
  | "post-audience"
  | "manual";

export interface AlertsDetectionJobPayload {
  userId: string | null;
  reason: AlertsDetectionReason;
  schedulerId?: AlertsDetectionSchedulerId | null;
}

export type AlertsDispatchAlertType =
  | "engagement_drop"
  | "traffic_spike"
  | "top_link";

export interface AlertsDispatchJobPayload {
  userId: string;
  type: AlertsDispatchAlertType;
  headline: string;
  message: string;
  metadata: Record<string, string | number | boolean | null>;
  dedupeKey: string;
  deepLinkPath: string;
  occurredAtMs: number;
  source: "rule" | "ai";
}

let cachedAlertsDetectionQueue: Queue<AlertsDetectionJobPayload> | null = null;

export const getAlertsDetectionQueue =
  (): Queue<AlertsDetectionJobPayload> => {
    if (cachedAlertsDetectionQueue) {
      return cachedAlertsDetectionQueue;
    }

    cachedAlertsDetectionQueue = new Queue<AlertsDetectionJobPayload>(
      ALERTS_DETECTION_QUEUE_NAME,
      {
        connection: getBullmqRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: { age: 60 * 60 * 6, count: 500 },
          removeOnFail: { age: 60 * 60 * 24 * 7 },
        },
      },
    );

    return cachedAlertsDetectionQueue;
  };

export const createAlertsDetectionWorker = (
  processor: Processor<AlertsDetectionJobPayload>,
  workerOptions: Omit<WorkerOptions, "connection"> = {},
): Worker<AlertsDetectionJobPayload> => {
  return new Worker<AlertsDetectionJobPayload>(
    ALERTS_DETECTION_QUEUE_NAME,
    processor,
    {
      connection: getBullmqRedisConnection(),
      concurrency:
        workerOptions.concurrency ?? env.ALERTS_DETECTION_WORKER_CONCURRENCY,
      ...workerOptions,
    },
  );
};

let cachedAlertsDispatchQueue: Queue<AlertsDispatchJobPayload> | null = null;

export const getAlertsDispatchQueue = (): Queue<AlertsDispatchJobPayload> => {
  if (cachedAlertsDispatchQueue) {
    return cachedAlertsDispatchQueue;
  }

  cachedAlertsDispatchQueue = new Queue<AlertsDispatchJobPayload>(
    ALERTS_DISPATCH_QUEUE_NAME,
    {
      connection: getBullmqRedisConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: { age: 60 * 60 * 24 * 3, count: 5000 },
        removeOnFail: { age: 60 * 60 * 24 * 14 },
      },
    },
  );

  return cachedAlertsDispatchQueue;
};

export const createAlertsDispatchWorker = (
  processor: Processor<AlertsDispatchJobPayload>,
  workerOptions: Omit<WorkerOptions, "connection"> = {},
): Worker<AlertsDispatchJobPayload> => {
  return new Worker<AlertsDispatchJobPayload>(
    ALERTS_DISPATCH_QUEUE_NAME,
    processor,
    {
      connection: getBullmqRedisConnection(),
      concurrency:
        workerOptions.concurrency ?? env.ALERTS_DISPATCH_WORKER_CONCURRENCY,
      ...workerOptions,
    },
  );
};

export const scheduleRecurringAlertsDetection = async (): Promise<void> => {
  const alertsDetectionQueue = getAlertsDetectionQueue();

  await Promise.all([
    alertsDetectionQueue.upsertJobScheduler(
      ALERTS_DETECTION_SCHEDULER_IDS.hourly,
      { pattern: env.ALERTS_DETECTION_CRON_HOURLY },
      {
        name: ALERTS_DETECTION_SCHEDULER_IDS.hourly,
        data: {
          userId: null,
          reason: "cron-hourly",
          schedulerId: ALERTS_DETECTION_SCHEDULER_IDS.hourly,
        },
      },
    ),
    alertsDetectionQueue.upsertJobScheduler(
      ALERTS_DETECTION_SCHEDULER_IDS.dailySummary,
      { pattern: env.ALERTS_DETECTION_CRON_DAILY },
      {
        name: ALERTS_DETECTION_SCHEDULER_IDS.dailySummary,
        data: {
          userId: null,
          reason: "cron-daily",
          schedulerId: ALERTS_DETECTION_SCHEDULER_IDS.dailySummary,
        },
      },
    ),
  ]);
};

const ALERTS_HOUR_BUCKET_MS = 60 * 60 * 1000;

const computeCurrentAlertsHourBucket = (): number =>
  Math.floor(Date.now() / ALERTS_HOUR_BUCKET_MS);

export const buildAlertsDetectionJobId = (
  userId: string,
  reason: AlertsDetectionReason,
): string => {
  const hourBucket = computeCurrentAlertsHourBucket();
  return `det:${userId}:${reason}:${hourBucket}`;
};

export const enqueuePerUserAlertsDetectionJob = async (
  userId: string,
  reason: AlertsDetectionReason,
): Promise<void> => {
  const alertsDetectionQueue = getAlertsDetectionQueue();
  await alertsDetectionQueue.add(
    "detect-user",
    {
      userId,
      reason,
      schedulerId: null,
    },
    {
      jobId: buildAlertsDetectionJobId(userId, reason),
    },
  );
};
