import express, { type Request, type Response } from "express";
import mongoose from "mongoose";

import { env } from "./config/env";
import { connectToDatabase } from "./infrastructure/db";
import {
  connectToRabbitMQ,
  getRabbitMQConnection,
} from "./infrastructure/rabbitmq";
import { connectToRedis, getRedisClient } from "./infrastructure/redis";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import apiRouter from "./api/routes";
import { notFoundHandler } from "./api/middlewares/notFoundHandler";
import { errorHandler } from "./api/middlewares/errorHandler";

const app = express();

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
app.use(morgan("dev"));
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `windowMs`
    message: "Too many requests, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use("/api", apiRequestLoggerMiddleware);
app.use("/api", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

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

const startServer = async (): Promise<void> => {
  await connectToDatabase();
  console.log("DB connected successfully");

  await connectToRedis();
  console.log("Redis connected successfully");

  await connectToRabbitMQ();
  console.log("RabbitMQ connected successfully");

  app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
  });
};

startServer().catch((error: unknown) => {
  console.error("Server startup failed", error);
  process.exit(1);
});
