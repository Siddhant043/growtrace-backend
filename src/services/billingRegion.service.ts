import type { SubscriptionPlanTier } from "../api/validators/payments.validator.js";
import {
  isSupportedCountryCode,
  normalizeCountryCode,
} from "../constants/countries.js";
import { env } from "../config/env.js";

export const INDIA_COUNTRY_CODE = "IN" as const;

export const BILLING_REGIONS = ["domestic", "international"] as const;
export type BillingRegion = (typeof BILLING_REGIONS)[number];

export const BILLING_CURRENCIES = ["INR", "USD"] as const;
export type BillingCurrency = (typeof BILLING_CURRENCIES)[number];

type ApiError = Error & { statusCode: number; code?: string };

const createApiError = (
  message: string,
  statusCode: number,
  code?: string,
): ApiError => {
  const apiError = new Error(message) as ApiError;
  apiError.statusCode = statusCode;
  apiError.code = code;
  return apiError;
};

export const resolveBillingRegion = (
  countryCode: string,
): BillingRegion =>
  normalizeCountryCode(countryCode) === INDIA_COUNTRY_CODE
    ? "domestic"
    : "international";

export const resolveCurrencyForBillingRegion = (
  billingRegion: BillingRegion,
): BillingCurrency => (billingRegion === "domestic" ? "INR" : "USD");

export const resolveBillingRegionFromCountryCode = (
  countryCode: string | null | undefined,
): BillingRegion | null => {
  if (!countryCode || !countryCode.trim()) {
    return null;
  }

  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!isSupportedCountryCode(normalizedCountryCode)) {
    return null;
  }

  return resolveBillingRegion(normalizedCountryCode);
};

export const resolvePlanIdForTierAndRegion = (
  planTier: SubscriptionPlanTier,
  billingRegion: BillingRegion,
): string => {
  if (billingRegion === "domestic") {
    return planTier === "monthly"
      ? env.RAZORPAY_PRO_MONTHLY_PLAN_ID
      : env.RAZORPAY_PRO_YEARLY_PLAN_ID;
  }

  return planTier === "monthly"
    ? env.RAZORPAY_PRO_MONTHLY_PLAN_ID_INTL
    : env.RAZORPAY_PRO_YEARLY_PLAN_ID_INTL;
};

export const assertUserHasCountryForCheckout = (parameters: {
  countryCode: string | null | undefined;
}): { countryCode: string; billingRegion: BillingRegion } => {
  const normalizedCountryCode = parameters.countryCode
    ? normalizeCountryCode(parameters.countryCode)
    : "";

  if (!normalizedCountryCode || !isSupportedCountryCode(normalizedCountryCode)) {
    throw createApiError(
      "Country is required before starting checkout",
      400,
      "COUNTRY_REQUIRED",
    );
  }

  return {
    countryCode: normalizedCountryCode,
    billingRegion: resolveBillingRegion(normalizedCountryCode),
  };
};
