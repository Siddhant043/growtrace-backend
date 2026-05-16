import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

import { SubscriptionModel } from "../../src/api/models/subscription.model.js";
import { UserModel } from "../../src/api/models/user.model.js";

const mockFetchRazorpaySubscription = vi.fn();
const mockGetOrCreateRazorpayCustomer = vi.fn();

vi.mock("../../src/infrastructure/razorpay.js", () => ({
  fetchRazorpaySubscription: (...arguments_: unknown[]) =>
    mockFetchRazorpaySubscription(...arguments_),
  getOrCreateRazorpayCustomer: (...arguments_: unknown[]) =>
    mockGetOrCreateRazorpayCustomer(...arguments_),
}));

import {
  ensureRazorpayCustomerForCheckout,
  resolveRazorpayCustomerIdForUser,
} from "../../src/services/subscriptionCheckout.service.js";

const userId = new Types.ObjectId("507f1f77bcf86cd799439011");

describe("subscriptionCheckout.service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockFetchRazorpaySubscription.mockReset();
    mockGetOrCreateRazorpayCustomer.mockReset();
  });

  it("resolveRazorpayCustomerIdForUser backfills from latest subscription", async () => {
    vi.spyOn(SubscriptionModel, "findOne").mockReturnValue({
      sort: () => ({
        select: () => ({
          lean: async () => ({ razorpayCustomerId: "cust_from_sub" }),
        }),
      }),
    } as never);
    const updateSpy = vi
      .spyOn(UserModel, "updateOne")
      .mockResolvedValue({ acknowledged: true } as never);

    const resolvedId = await resolveRazorpayCustomerIdForUser({
      userId,
      razorpayCustomerId: null,
      razorpaySubscriptionId: null,
    });

    expect(resolvedId).toBe("cust_from_sub");
    expect(updateSpy).toHaveBeenCalledWith(
      { _id: userId },
      { $set: { razorpayCustomerId: "cust_from_sub" } },
    );
  });

  it("resolveRazorpayCustomerIdForUser fetches customer from Razorpay subscription id", async () => {
    vi.spyOn(SubscriptionModel, "findOne").mockReturnValue({
      sort: () => ({
        select: () => ({
          lean: async () => null,
        }),
      }),
    } as never);
    mockFetchRazorpaySubscription.mockResolvedValue({
      id: "sub_123",
      status: "created",
      shortUrl: "https://rzp.io/i/example",
      planId: "plan_123",
      totalCount: 12,
      startAt: null,
      endAt: null,
      chargeAt: null,
      currentStart: null,
      currentEnd: null,
      customerId: "cust_from_razorpay_sub",
      paidCount: 0,
    });
    vi.spyOn(UserModel, "updateOne").mockResolvedValue({
      acknowledged: true,
    } as never);

    const resolvedId = await resolveRazorpayCustomerIdForUser({
      userId,
      razorpayCustomerId: null,
      razorpaySubscriptionId: "sub_123",
    });

    expect(resolvedId).toBe("cust_from_razorpay_sub");
    expect(mockFetchRazorpaySubscription).toHaveBeenCalledWith("sub_123");
  });

  it("ensureRazorpayCustomerForCheckout passes resolved id to getOrCreate", async () => {
    vi.spyOn(SubscriptionModel, "findOne").mockReturnValue({
      sort: () => ({
        select: () => ({
          lean: async () => ({ razorpayCustomerId: "cust_resolved" }),
        }),
      }),
    } as never);
    vi.spyOn(UserModel, "updateOne").mockResolvedValue({
      acknowledged: true,
    } as never);
    mockGetOrCreateRazorpayCustomer.mockResolvedValue({
      id: "cust_resolved",
      email: "user@example.com",
      name: "User",
    });

    await ensureRazorpayCustomerForCheckout({
      _id: userId,
      email: "user@example.com",
      fullName: "User",
      razorpayCustomerId: null,
      razorpaySubscriptionId: null,
    });

    expect(mockGetOrCreateRazorpayCustomer).toHaveBeenCalledWith({
      user: expect.objectContaining({
        razorpayCustomerId: "cust_resolved",
      }),
    });
  });
});
