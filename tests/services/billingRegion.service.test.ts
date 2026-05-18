import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/env.js", () => ({
  env: {
    RAZORPAY_PRO_MONTHLY_PLAN_ID: "plan_inr_monthly",
    RAZORPAY_PRO_YEARLY_PLAN_ID: "plan_inr_yearly",
    RAZORPAY_PRO_MONTHLY_PLAN_ID_INTL: "plan_usd_monthly",
    RAZORPAY_PRO_YEARLY_PLAN_ID_INTL: "plan_usd_yearly",
  },
}));

import {
  assertUserHasCountryForCheckout,
  resolveBillingRegion,
  resolveCurrencyForBillingRegion,
  resolvePlanIdForTierAndRegion,
} from "../../src/services/billingRegion.service.js";

describe("billingRegion.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves India as domestic INR", () => {
    expect(resolveBillingRegion("IN")).toBe("domestic");
    expect(resolveCurrencyForBillingRegion("domestic")).toBe("INR");
  });

  it("resolves non-India as international USD", () => {
    expect(resolveBillingRegion("US")).toBe("international");
    expect(resolveCurrencyForBillingRegion("international")).toBe("USD");
  });

  it("maps plan tiers to domestic Razorpay plan ids", () => {
    expect(resolvePlanIdForTierAndRegion("monthly", "domestic")).toBe(
      "plan_inr_monthly",
    );
    expect(resolvePlanIdForTierAndRegion("yearly", "domestic")).toBe(
      "plan_inr_yearly",
    );
  });

  it("maps plan tiers to international Razorpay plan ids", () => {
    expect(resolvePlanIdForTierAndRegion("monthly", "international")).toBe(
      "plan_usd_monthly",
    );
    expect(resolvePlanIdForTierAndRegion("yearly", "international")).toBe(
      "plan_usd_yearly",
    );
  });

  it("throws COUNTRY_REQUIRED when country is missing", () => {
    try {
      assertUserHasCountryForCheckout({ countryCode: null });
      expect.fail("Expected checkout guard to throw");
    } catch (thrownValue) {
      expect(thrownValue).toMatchObject({
        message: "Country is required before starting checkout",
        statusCode: 400,
        code: "COUNTRY_REQUIRED",
      });
    }
  });

  it("normalizes country code before resolving billing region", () => {
    const resolved = assertUserHasCountryForCheckout({ countryCode: " us " });
    expect(resolved).toEqual({
      countryCode: "US",
      billingRegion: "international",
    });
  });
});
