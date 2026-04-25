import { connect, type RabbitMQConnection } from "amqplib";

import { env } from "../config/env";

let rabbitMQConnection: RabbitMQConnection | null = null;

const rabbitMQConnectionUrl = `amqp://${encodeURIComponent(env.RABBITMQ_DEFAULT_USER)}:${encodeURIComponent(env.RABBITMQ_DEFAULT_PASS)}@${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}`;

export const connectToRabbitMQ = async (): Promise<RabbitMQConnection> => {
  if (rabbitMQConnection) {
    return rabbitMQConnection;
  }

  rabbitMQConnection = await connect(rabbitMQConnectionUrl);
  return rabbitMQConnection;
};

export const getRabbitMQConnection = (): RabbitMQConnection | null =>
  rabbitMQConnection;
