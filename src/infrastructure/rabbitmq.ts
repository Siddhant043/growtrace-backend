import amqp, { type Channel, type ChannelModel } from "amqplib";

import { env } from "../config/env.js";
import { captureSystemError } from "../services/systemMonitoring.errorLog.service.js";

const ANALYTICS_EXCHANGE_NAME = "analytics_exchange" as const;
const ANALYTICS_EXCHANGE_TYPE = "topic" as const;
export const ANALYTICS_INSIGHTS_ROUTING_KEY = "generate_insights" as const;

let cachedRabbitMqConnection: ChannelModel | null = null;
let cachedRabbitMqChannel: Channel | null = null;
let analyticsExchangeAssertedFlag = false;

const buildRabbitMqConnectionUrl = (): string =>
  env.RABBITMQ_URL ||
  `amqp://${encodeURIComponent(env.RABBITMQ_DEFAULT_USER)}:${encodeURIComponent(
    env.RABBITMQ_DEFAULT_PASS,
  )}@${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}`;

export const connectToRabbitMQ = async (): Promise<ChannelModel> => {
  if (cachedRabbitMqConnection) {
    return cachedRabbitMqConnection;
  }

  cachedRabbitMqConnection = await amqp.connect(buildRabbitMqConnectionUrl());

  cachedRabbitMqConnection.on("error", (connectionError: unknown) => {
    void captureSystemError({
      source: "queue",
      service: "infrastructure.rabbitmq.connection",
      severity: "high",
      message:
        connectionError instanceof Error
          ? connectionError.message
          : String(connectionError),
      stack: connectionError instanceof Error ? (connectionError.stack ?? null) : null,
      metadata: { event: "connection_error" },
    });
    console.error("[infrastructure.rabbitmq] connection error", {
      error:
        connectionError instanceof Error
          ? connectionError.message
          : String(connectionError),
    });
  });

  cachedRabbitMqConnection.on("close", () => {
    void captureSystemError({
      source: "queue",
      service: "infrastructure.rabbitmq.connection",
      severity: "medium",
      message: "RabbitMQ connection closed",
      metadata: { event: "connection_closed" },
    });
    console.warn("[infrastructure.rabbitmq] connection closed");
    cachedRabbitMqConnection = null;
    cachedRabbitMqChannel = null;
    analyticsExchangeAssertedFlag = false;
  });

  return cachedRabbitMqConnection;
};

export const getRabbitMQConnection = (): ChannelModel | null =>
  cachedRabbitMqConnection;

const getRabbitMqPublisherChannel = async (): Promise<Channel> => {
  if (cachedRabbitMqChannel) {
    return cachedRabbitMqChannel;
  }
  const connection = await connectToRabbitMQ();
  cachedRabbitMqChannel = await connection.createChannel();

  cachedRabbitMqChannel.on("error", (channelError: unknown) => {
    void captureSystemError({
      source: "queue",
      service: "infrastructure.rabbitmq.channel",
      severity: "high",
      message: channelError instanceof Error ? channelError.message : String(channelError),
      stack: channelError instanceof Error ? (channelError.stack ?? null) : null,
      metadata: { event: "channel_error" },
    });
    console.error("[infrastructure.rabbitmq] channel error", {
      error:
        channelError instanceof Error
          ? channelError.message
          : String(channelError),
    });
  });

  cachedRabbitMqChannel.on("close", () => {
    void captureSystemError({
      source: "queue",
      service: "infrastructure.rabbitmq.channel",
      severity: "medium",
      message: "RabbitMQ channel closed",
      metadata: { event: "channel_closed" },
    });
    console.warn("[infrastructure.rabbitmq] channel closed");
    cachedRabbitMqChannel = null;
    analyticsExchangeAssertedFlag = false;
  });

  return cachedRabbitMqChannel;
};

const ensureAnalyticsExchangeAsserted = async (
  channel: Channel,
): Promise<void> => {
  if (analyticsExchangeAssertedFlag) return;
  await channel.assertExchange(
    ANALYTICS_EXCHANGE_NAME,
    ANALYTICS_EXCHANGE_TYPE,
    { durable: true },
  );
  analyticsExchangeAssertedFlag = true;
};

export const publishToAnalyticsExchange = async (
  routingKey: string,
  payload: Record<string, unknown>,
  options: { messageId?: string } = {},
): Promise<boolean> => {
  const channel = await getRabbitMqPublisherChannel();
  await ensureAnalyticsExchangeAsserted(channel);

  const serializedBuffer = Buffer.from(JSON.stringify(payload), "utf-8");
  return channel.publish(
    ANALYTICS_EXCHANGE_NAME,
    routingKey,
    serializedBuffer,
    {
      persistent: true,
      contentType: "application/json",
      timestamp: Date.now(),
      messageId: options.messageId,
    },
  );
};
