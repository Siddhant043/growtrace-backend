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
  RABBITMQ_URL: z.string().url("RABBITMQ_URL must be a valid URL").optional(),
  RABBITMQ_PORT: z.coerce.number().int().min(1).max(65535),
  RABBITMQ_HOST: z.string().min(1, "RABBITMQ_HOST is required"),
  RABBITMQ_DEFAULT_USER: z.string().min(1, "RABBITMQ_DEFAULT_USER is required"),
  RABBITMQ_DEFAULT_PASS: z.string().min(1, "RABBITMQ_DEFAULT_PASS is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRES_IN: z.string().min(1, "JWT_EXPIRES_IN is required"),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  CLIENT_APP_URL: z
    .string()
    .url("CLIENT_APP_URL must be a valid URL")
    .default("http://localhost:3000"),
  SHORT_LINK_BASE_URL: z
    .string()
    .url("SHORT_LINK_BASE_URL must be a valid URL")
    .default("http://localhost:8000"),
  SMTP_HOST: z.string().min(1, "SMTP_HOST is required").default("localhost"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z
    .string()
    .email("SMTP_FROM must be a valid email address")
    .default("no-reply@growtrace.local"),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  WEEKLY_REPORTS_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  WEEKLY_REPORTS_CRON: z.string().min(1).default("0 2 * * 0"),
  WEEKLY_REPORTS_WORKER_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(5),
  WEEKLY_REPORTS_EMAIL_FROM: z
    .string()
    .email("WEEKLY_REPORTS_EMAIL_FROM must be a valid email address")
    .optional(),
  ATTRIBUTION_JOURNEY_WINDOW_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(180)
    .default(7),
  ATTRIBUTION_TOUCHPOINT_TTL_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3650)
    .default(90),
  ATTRIBUTION_WORKER_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(8),
  ATTRIBUTION_USER_COOKIE_NAME: z.string().min(1).default("gt_uid"),
  ATTRIBUTION_USER_COOKIE_MAX_AGE_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3650)
    .default(730),
  AUDIENCE_AGGREGATION_WINDOW_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30),
  AUDIENCE_COHORT_WINDOW_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .default(90),
  AUDIENCE_WORKER_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(4),
  AUDIENCE_HIGH_ENGAGEMENT_SCORE_MIN: z.coerce.number().min(0).default(50),
  AUDIENCE_LOW_ENGAGEMENT_SCORE_MAX: z.coerce.number().min(0).default(20),
  AUDIENCE_AGGREGATION_CRON: z.string().min(1).default("*/5 * * * *"),
  ALERTS_DETECTION_CRON_HOURLY: z.string().min(1).default("0 * * * *"),
  ALERTS_DETECTION_CRON_DAILY: z.string().min(1).default("0 6 * * *"),
  ALERTS_ENGAGEMENT_DROP_THRESHOLD: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(0.8),
  ALERTS_TRAFFIC_SPIKE_MULTIPLIER: z.coerce.number().min(1).default(1.5),
  ALERTS_DEDUP_WINDOW_HOURS: z.coerce.number().int().min(1).max(168).default(6),
  ALERTS_NEW_USER_GRACE_DAYS: z.coerce.number().int().min(0).max(365).default(3),
  ALERTS_MIN_SESSIONS_FOR_SIGNAL: z.coerce
    .number()
    .int()
    .min(0)
    .max(1000)
    .default(5),
  ALERTS_DETECTION_WORKER_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(4),
  ALERTS_DISPATCH_WORKER_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(8),
  ALERTS_DETECTION_ACTIVE_WINDOW_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(60)
    .default(7),
  ALERTS_FROM_EMAIL: z
    .string()
    .email("ALERTS_FROM_EMAIL must be a valid email address")
    .optional(),
  RAZORPAY_KEY_ID: z.string().min(1, "RAZORPAY_KEY_ID is required"),
  RAZORPAY_KEY_SECRET: z.string().min(1, "RAZORPAY_KEY_SECRET is required"),
  RAZORPAY_WEBHOOK_SECRET: z
    .string()
    .min(1, "RAZORPAY_WEBHOOK_SECRET is required"),
  RAZORPAY_PRO_MONTHLY_PLAN_ID: z
    .string()
    .min(1, "RAZORPAY_PRO_MONTHLY_PLAN_ID is required"),
  RAZORPAY_PRO_YEARLY_PLAN_ID: z.string().min(1).optional(),
  BILLING_GRACE_PERIOD_HOURS: z.coerce
    .number()
    .int()
    .min(0)
    .max(168)
    .default(24),
  BULL_BOARD_USERNAME: z.string().min(1, "BULL_BOARD_USERNAME is required"),
  BULL_BOARD_PASSWORD: z.string().min(1, "BULL_BOARD_PASSWORD is required"),
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
