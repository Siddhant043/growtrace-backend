import Redis from "ioredis";

import { env } from "../config/env";

let redisClient: Redis | null = null;

export const createRedisClient = (): Redis => {
  if (redisClient) {
    return redisClient;
  }

  redisClient = new Redis(env.REDIS_URL, { lazyConnect: true });
  return redisClient;
};

export const connectToRedis = async (): Promise<Redis> => {
  const client = createRedisClient();

  if (
    client.status === "ready" ||
    client.status === "connect" ||
    client.status === "connecting"
  ) {
    return client;
  }

  await client.connect();
  return client;
};

export const getRedisClient = (): Redis => createRedisClient();
