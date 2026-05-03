import {
  SUBSCRIPTION_TYPES,
  type SubscriptionType,
} from "../../api/models/user.model.js";

export const PLAN_FEATURES_LIST = [
  "link_creation",
  "click_tracking",
  "basic_analytics",
  "session_overview",
  "behavior_tracking",
  "engagement_metrics",
  "funnel_analytics",
  "ai_insights",
  "advanced_analytics",
  "smart_alerts",
  "weekly_reports",
  "audience_intelligence",
  "multi_touch_attribution",
] as const;

export type PlanFeature = (typeof PLAN_FEATURES_LIST)[number];

const FREE_FEATURES: ReadonlyArray<PlanFeature> = [
  "link_creation",
  "click_tracking",
  "basic_analytics",
  "session_overview",
];

const PRO_FEATURES: ReadonlyArray<PlanFeature> = [
  ...FREE_FEATURES,
  "behavior_tracking",
  "engagement_metrics",
  "funnel_analytics",
  "ai_insights",
  "advanced_analytics",
  "smart_alerts",
  "weekly_reports",
  "audience_intelligence",
  "multi_touch_attribution",
];

export const PLAN_FEATURES: Record<SubscriptionType, ReadonlyArray<PlanFeature>> = {
  free: FREE_FEATURES,
  pro: PRO_FEATURES,
};

export const hasFeature = (
  plan: SubscriptionType,
  feature: PlanFeature,
): boolean => PLAN_FEATURES[plan].includes(feature);

export const getPlanFeatures = (
  plan: SubscriptionType,
): ReadonlyArray<PlanFeature> => PLAN_FEATURES[plan];

export const isValidSubscriptionPlan = (
  candidate: unknown,
): candidate is SubscriptionType =>
  typeof candidate === "string" &&
  (SUBSCRIPTION_TYPES as ReadonlyArray<string>).includes(candidate);
