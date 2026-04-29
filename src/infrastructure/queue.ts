import { Queue, Worker, type Processor, type WorkerOptions } from "bullmq";
import IORedis, { type Redis } from "ioredis";

import { env } from "../config/env";

export const BEHAVIOR_EVENTS_QUEUE_NAME = "behaviorEvents";
export const METRICS_AGGREGATION_QUEUE_NAME = "metricsAggregation";

export const METRICS_AGGREGATION_SCHEDULER_IDS = {
  currentUtcDay: "recompute-current-utc-day",
  previousUtcDay: "recompute-previous-utc-day",
} as const;

export type MetricsAggregationSchedulerId =
  (typeof METRICS_AGGREGATION_SCHEDULER_IDS)[keyof typeof METRICS_AGGREGATION_SCHEDULER_IDS];

export interface MetricsAggregationJobPayload {
  schedulerId: MetricsAggregationSchedulerId;
}

export interface BehaviorEventJobPayload {
  apiKey: string;
  userId: string;
  linkId: string | null;
  sessionId: string;
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
