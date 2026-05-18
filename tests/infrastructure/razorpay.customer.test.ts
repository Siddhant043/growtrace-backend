import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Razorpay from "razorpay";

import { UserModel } from "../../src/api/models/user.model.js";
import {
  findRazorpayCustomerByEmail,
  getOrCreateRazorpayCustomer,
  isRazorpayDuplicateCustomerError,
  normalizeEmailForCustomerMatch,
  resetRazorpayClientSingleton,
  setRazorpayClientSingletonForTests,
} from "../../src/infrastructure/razorpay.js";

const mockCustomersCreate = vi.fn();
const mockCustomersFetch = vi.fn();
const mockCustomersAll = vi.fn();

const mockRazorpayClient = {
  customers: {
    create: mockCustomersCreate,
    fetch: mockCustomersFetch,
    all: mockCustomersAll,
  },
} as unknown as Razorpay;

vi.mock("../../src/config/env.js", () => ({
  env: {
    RAZORPAY_KEY_ID: "rzp_test",
    RAZORPAY_KEY_SECRET: "secret",
    RAZORPAY_WEBHOOK_SECRET: "whsec",
    RAZORPAY_PRO_MONTHLY_PLAN_ID: "plan_test",
    RAZORPAY_PRO_YEARLY_PLAN_ID: "plan_test_yearly",
    RAZORPAY_PRO_MONTHLY_PLAN_ID_INTL: "plan_test_intl_monthly",
    RAZORPAY_PRO_YEARLY_PLAN_ID_INTL: "plan_test_intl_yearly",
    MONGO_URI: "localhost",
    MONGO_USER: "user",
    MONGO_PASSWORD: "pass",
    MONGO_DB: "db",
  },
}));

vi.mock("../../src/api/models/user.model.js", () => ({
  UserModel: {
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  },
}));

describe("razorpay customer helpers", () => {
  beforeEach(() => {
    setRazorpayClientSingletonForTests(mockRazorpayClient);
  });

  afterEach(() => {
    resetRazorpayClientSingleton();
    vi.clearAllMocks();
  });

  it("normalizeEmailForCustomerMatch lowercases and trims", () => {
    expect(
      normalizeEmailForCustomerMatch("  User@Example.COM "),
    ).toBe("user@example.com");
  });

  it("isRazorpayDuplicateCustomerError detects customer already exists", () => {
    expect(
      isRazorpayDuplicateCustomerError({
        statusCode: 400,
        error: {
          code: "BAD_REQUEST_ERROR",
          description: "Customer already exists for the merchant",
        },
      }),
    ).toBe(true);
  });

  it("getOrCreateRazorpayCustomer sends fail_existing as string 0", async () => {
    mockCustomersCreate.mockResolvedValue({
      id: "cust_new",
      email: "user@example.com",
      name: "User",
    });

    const summary = await getOrCreateRazorpayCustomer({
      user: {
        _id: "507f1f77bcf86cd799439011",
        email: "user@example.com",
        fullName: "User",
        razorpayCustomerId: null,
      },
    });

    expect(mockCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        fail_existing: "0",
        email: "user@example.com",
      }),
    );
    expect(summary.id).toBe("cust_new");
    expect(UserModel.updateOne).toHaveBeenCalled();
  });

  it("getOrCreateRazorpayCustomer does not call create when stored customer id is valid", async () => {
    mockCustomersFetch.mockResolvedValue({
      id: "cust_existing",
      email: "user@example.com",
      name: "User",
    });

    const summary = await getOrCreateRazorpayCustomer({
      user: {
        _id: "507f1f77bcf86cd799439011",
        email: "user@example.com",
        fullName: "User",
        razorpayCustomerId: "cust_existing",
      },
    });

    expect(mockCustomersFetch).toHaveBeenCalledWith("cust_existing");
    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(summary.id).toBe("cust_existing");
  });

  it("falls back to email lookup when create returns duplicate customer error", async () => {
    mockCustomersCreate.mockRejectedValue({
      statusCode: 400,
      error: {
        code: "BAD_REQUEST_ERROR",
        description: "Customer already exists for the merchant",
      },
    });
    mockCustomersAll.mockResolvedValue({
      items: [
        {
          id: "cust_from_list",
          email: "user@example.com",
          name: "User",
        },
      ],
      count: 1,
    });

    const summary = await getOrCreateRazorpayCustomer({
      user: {
        _id: "507f1f77bcf86cd799439011",
        email: "user@example.com",
        fullName: "User",
        razorpayCustomerId: null,
      },
    });

    expect(mockCustomersAll).toHaveBeenCalled();
    expect(summary.id).toBe("cust_from_list");
  });

  it("findRazorpayCustomerByEmail matches email case-insensitively", async () => {
    mockCustomersAll.mockResolvedValue({
      items: [
        {
          id: "cust_match",
          email: "User@Example.COM",
          name: "User",
        },
      ],
      count: 1,
    });

    const foundCustomer = await findRazorpayCustomerByEmail("user@example.com");
    expect(foundCustomer?.id).toBe("cust_match");
  });
});
