import express, { type Request, type Response } from "express";
import mongoose from "mongoose";

import { env } from "./config/env.js";
import { connectToDatabase } from "./infrastructure/db.js";
import {
  connectToRabbitMQ,
  getRabbitMQConnection,
} from "./infrastructure/rabbitmq.js";
import { connectToRedis, getRedisClient } from "./infrastructure/redis.js";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import apiRouter from "./api/routes/index.js";
import { notFoundHandler } from "./api/middlewares/notFoundHandler.js";
import { errorHandler } from "./api/middlewares/errorHandler.js";
import redirectRouter from "./api/routes/redirect.js";
import trackRouter from "./api/routes/track.js";
import {
  BULL_BOARD_BASE_PATH,
  createBullBoardServerAdapter,
} from "./infrastructure/bullBoard.js";
import {
  scheduleRecurringAdminAnalyticsAggregation,
  scheduleRecurringAlertsDetection,
  scheduleRecurringAudienceAggregation,
  scheduleRecurringFunnelAggregation,
  scheduleRecurringMetricsAggregation,
  scheduleRecurringWeeklyReportsProducer,
} from "./infrastructure/queue.js";
import { startBehaviorEventsWorker } from "./workers/behaviorEvents.worker.js";
import { startMetricsAggregationWorker } from "./workers/metricsAggregation.worker.js";
import { startFunnelAggregationWorker } from "./workers/funnelAggregation.worker.js";
import { startWeeklyReportsWorker } from "./workers/weeklyReports.worker.js";
import { startAttributionWorker } from "./workers/attribution.worker.js";
import { startAudienceAggregationWorker } from "./workers/audienceAggregation.worker.js";
import { startAlertsDetectionWorker } from "./workers/alertsDetection.worker.js";
import { startAlertsDispatchWorker } from "./workers/alertsDispatch.worker.js";
import { startAdminAnalyticsAggregationWorkers } from "./workers/adminAnalyticsAggregation.worker.js";
import {
  startSystemMonitoringWorker,
  stopSystemMonitoringWorker,
} from "./workers/systemMonitoring.worker.js";

const app = express();

const requireBullBoardBasicAuthMiddleware = (
  request: Request,
  response: Response,
  next: () => void,
): void => {
  const authorizationHeaderValue = request.headers.authorization;

  if (!authorizationHeaderValue?.startsWith("Basic ")) {
    response.setHeader("WWW-Authenticate", 'Basic realm="Bull Board"');
    response.status(401).send("Authentication required");
    return;
  }

  const base64EncodedCredentials = authorizationHeaderValue.slice("Basic ".length);
  const decodedCredentials = Buffer.from(base64EncodedCredentials, "base64").toString(
    "utf8",
  );
  const firstColonSeparatorIndex = decodedCredentials.indexOf(":");

  if (firstColonSeparatorIndex === -1) {
    response.setHeader("WWW-Authenticate", 'Basic realm="Bull Board"');
    response.status(401).send("Invalid credentials format");
    return;
  }

  const providedUsername = decodedCredentials.slice(0, firstColonSeparatorIndex);
  const providedPassword = decodedCredentials.slice(firstColonSeparatorIndex + 1);
  const hasValidCredentials =
    providedUsername === env.BULL_BOARD_USERNAME &&
    providedPassword === env.BULL_BOARD_PASSWORD;

  if (!hasValidCredentials) {
    response.setHeader("WWW-Authenticate", 'Basic realm="Bull Board"');
    response.status(401).send("Invalid username or password");
    return;
  }

  next();
};

const apiRequestLoggerMiddleware = (
  request: Request,
  response: Response,
  next: () => void,
): void => {
  const requestStartedAt = process.hrtime.bigint();

  response.on("finish", () => {
    const requestFinishedAt = process.hrtime.bigint();
    const requestDurationMs =
      Number(requestFinishedAt - requestStartedAt) / 1_000_000;
    const responseSize = response.getHeader("content-length") ?? "unknown";

    console.info(
      `[API] ${request.method} ${request.originalUrl} ` +
        `status=${response.statusCode} durationMs=${requestDurationMs.toFixed(2)} ` +
        `ip=${request.ip ?? "unknown"} userAgent="${request.get("user-agent") ?? "unknown"}" ` +
        `responseSize=${String(responseSize)}`,
    );
  });

  next();
};

app.use(helmet());
app.use(cors());
app.use(cookieParser());
app.use(morgan("dev"));
app.use(
  express.json({
    verify: (request, _response, rawBuffer) => {
      if (
        typeof request.url === "string" &&
        request.url.startsWith("/api/webhooks/")
      ) {
        (request as Request & { rawBody?: Buffer }).rawBody =
          Buffer.from(rawBuffer);
      }
    },
  }),
);
const shouldEnableRateLimiting = !["development", "test"].includes(env.ENV);

if (shouldEnableRateLimiting) {
  app.use(
    rateLimit({
      windowMs: 10 * 60 * 1000, // 10 minutes
      limit: 500, // Limit each IP to 500 requests per `windowMs`
      message: "Too many requests, please try again later.",
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
}
app.use("/track", trackRouter);

const bullBoardServerAdapter = createBullBoardServerAdapter();
app.use(
  BULL_BOARD_BASE_PATH,
  requireBullBoardBasicAuthMiddleware,
  bullBoardServerAdapter.getRouter(),
);

app.use("/api", apiRequestLoggerMiddleware);
app.use("/api", apiRouter);
app.use("/", redirectRouter);

app.get("/api/health", (_request: Request, response: Response) => {
  const redisClient = getRedisClient();
  const rabbitMQConnection = getRabbitMQConnection();

  const healthStatus = {
    status: "ok",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    redis:
      redisClient.status === "ready" || redisClient.status === "connect"
        ? "connected"
        : "disconnected",
    rabbitmq: rabbitMQConnection ? "connected" : "disconnected",
  };

  const hasDisconnectedService = Object.values(healthStatus).some(
    (value) => value === "disconnected",
  );

  if (hasDisconnectedService) {
    response.status(503).json(healthStatus);
    return;
  }

  response.status(200).json(healthStatus);
});

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async (): Promise<void> => {
  await connectToDatabase();
  console.log("DB connected successfully");

  await connectToRedis();
  console.log("Redis connected successfully");

  await connectToRabbitMQ();
  console.log("RabbitMQ connected successfully");

  const behaviorEventsWorker = startBehaviorEventsWorker();
  console.log(
    `behaviorEvents worker running (env=${env.ENV}, pid=${process.pid})`,
  );

  const metricsAggregationWorker = startMetricsAggregationWorker();
  console.log(
    `metricsAggregation worker running (env=${env.ENV}, pid=${process.pid})`,
  );

  await scheduleRecurringMetricsAggregation();
  console.log(
    "metricsAggregation jobs scheduled (every 5m, current+previous UTC day)",
  );

  const funnelAggregationWorker = startFunnelAggregationWorker();
  console.log(
    `funnelAggregation worker running (env=${env.ENV}, pid=${process.pid})`,
  );

  await scheduleRecurringFunnelAggregation();
  console.log(
    "funnelAggregation jobs scheduled (every 5m, current+previous UTC day)",
  );

  const weeklyReportsWorker = startWeeklyReportsWorker();
  console.log(
    `weeklyReports worker running (env=${env.ENV}, pid=${process.pid}, concurrency=${env.WEEKLY_REPORTS_WORKER_CONCURRENCY})`,
  );

  if (env.WEEKLY_REPORTS_ENABLED) {
    await scheduleRecurringWeeklyReportsProducer(env.WEEKLY_REPORTS_CRON);
    console.log(
      `weeklyReports producer scheduled (cron='${env.WEEKLY_REPORTS_CRON}')`,
    );
  } else {
    console.log("weeklyReports disabled via WEEKLY_REPORTS_ENABLED=false");
  }

  const attributionWorker = startAttributionWorker();
  console.log(
    `attribution worker running (env=${env.ENV}, pid=${process.pid}, concurrency=${env.ATTRIBUTION_WORKER_CONCURRENCY})`,
  );

  const audienceAggregationWorker = startAudienceAggregationWorker();
  console.log(
    `audienceAggregation worker running (env=${env.ENV}, pid=${process.pid}, concurrency=${env.AUDIENCE_WORKER_CONCURRENCY})`,
  );

  await scheduleRecurringAudienceAggregation();
  console.log(
    `audienceAggregation rollup scheduled (cron='${env.AUDIENCE_AGGREGATION_CRON}', windowDays=${env.AUDIENCE_AGGREGATION_WINDOW_DAYS})`,
  );

  const alertsDetectionWorker = startAlertsDetectionWorker();
  console.log(
    `alertsDetection worker running (env=${env.ENV}, pid=${process.pid}, concurrency=${env.ALERTS_DETECTION_WORKER_CONCURRENCY})`,
  );

  const alertsDispatchWorker = startAlertsDispatchWorker();
  console.log(
    `alertsDispatch worker running (env=${env.ENV}, pid=${process.pid}, concurrency=${env.ALERTS_DISPATCH_WORKER_CONCURRENCY})`,
  );

  await scheduleRecurringAlertsDetection();
  console.log(
    `alertsDetection schedules upserted (hourly='${env.ALERTS_DETECTION_CRON_HOURLY}', daily='${env.ALERTS_DETECTION_CRON_DAILY}')`,
  );

  const {
    platformWorker: adminPlatformMetricsAggregationWorker,
    usageWorker: adminUsageMetricsAggregationWorker,
    funnelWorker: adminFunnelMetricsAggregationWorker,
  } = startAdminAnalyticsAggregationWorkers();
  console.log(
    `admin analytics workers running (env=${env.ENV}, pid=${process.pid})`,
  );

  await scheduleRecurringAdminAnalyticsAggregation();
  console.log(
    `admin analytics aggregation schedules upserted (cron='${env.ADMIN_ANALYTICS_AGGREGATION_CRON}', queues=platform+usage+funnel)`,
  );

  const systemMonitoringInterval = startSystemMonitoringWorker();
  console.log(
    `system monitoring worker running (intervalMs=${String(systemMonitoringInterval ? 20000 : 0)})`,
  );

  const httpServer = app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
    console.log(
      `Bull Board running on http://localhost:${env.PORT}${BULL_BOARD_BASE_PATH}`,
    );
  });

  const shutdownGracefully = async (signalName: string): Promise<void> => {
    console.log(`Received ${signalName}, shutting down...`);
    httpServer.close();
    try {
      await Promise.all([
        behaviorEventsWorker.close(),
        metricsAggregationWorker.close(),
        funnelAggregationWorker.close(),
        weeklyReportsWorker.close(),
        attributionWorker.close(),
        audienceAggregationWorker.close(),
        alertsDetectionWorker.close(),
        alertsDispatchWorker.close(),
        adminPlatformMetricsAggregationWorker.close(),
        adminUsageMetricsAggregationWorker.close(),
        adminFunnelMetricsAggregationWorker.close(),
      ]);
      stopSystemMonitoringWorker();
    } finally {
      process.exit(0);
    }
  };

  process.once("SIGINT", () => {
    void shutdownGracefully("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdownGracefully("SIGTERM");
  });
};

startServer().catch((error: unknown) => {
  console.error("Server startup failed", error);
  process.exit(1);
});
