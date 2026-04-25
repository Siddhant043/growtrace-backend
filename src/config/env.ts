import { config as loadEnvironmentFile } from "dotenv";
import { z } from "zod";

loadEnvironmentFile({ path: ".env" });
loadEnvironmentFile();

const runtimeEnvironmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  MONGO_USER: z.string().min(1, "MONGO_USER is required"),
  MONGO_PASSWORD: z.string().min(1, "MONGO_PASSWORD is required"),
  MONGO_DB: z.string().min(1, "MONGO_DB is required"),
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL"),
  RABBITMQ_PORT: z.coerce.number().int().min(1).max(65535),
  RABBITMQ_HOST: z.string().min(1, "RABBITMQ_HOST is required"),
  RABBITMQ_DEFAULT_USER: z.string().min(1, "RABBITMQ_DEFAULT_USER is required"),
  RABBITMQ_DEFAULT_PASS: z.string().min(1, "RABBITMQ_DEFAULT_PASS is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRES_IN: z.string().min(1, "JWT_EXPIRES_IN is required"),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
});

const parsedRuntimeEnvironment = runtimeEnvironmentSchema.safeParse(
  process.env,
);

if (!parsedRuntimeEnvironment.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(parsedRuntimeEnvironment.error.format(), null, 2)}`,
  );
}

export const env = parsedRuntimeEnvironment.data;

export type RuntimeEnvironment = typeof env;
