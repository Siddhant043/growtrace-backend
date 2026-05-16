import Razorpay from "razorpay";
import type { Types } from "mongoose";

import { env } from "../config/env.js";
import { UserModel } from "../api/models/user.model.js";
import { mapRazorpayFailureToApiError } from "./razorpayError.utils.js";

const SUBSCRIPTION_AUTH_EXPIRE_WINDOW_SECONDS = 7 * 24 * 60 * 60;

const CUSTOMER_LIST_PAGE_SIZE = 100;
const CUSTOMER_LIST_MAX_PAGES = 3;

/** Razorpay API expects string "0"/"1"; razorpay-node v2.9.x mishandles numeric 0. */
const RAZORPAY_FAIL_EXISTING_RETURN_EXISTING = "0" as unknown as 0;

let razorpaySingleton: Razorpay | null = null;

export const resetRazorpayClientSingleton = (): void => {
  razorpaySingleton = null;
};

export const setRazorpayClientSingletonForTests = (client: Razorpay): void => {
  razorpaySingleton = client;
};

export const getRazorpayClient = (): Razorpay => {
  if (razorpaySingleton) {
    return razorpaySingleton;
  }

  razorpaySingleton = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });

  return razorpaySingleton;
};

const sanitizeContactNumber = (
  rawContact: string | null | undefined,
): string | undefined => {
  if (!rawContact) {
    return undefined;
  }
  const trimmedContact = rawContact.trim();
  if (trimmedContact.length === 0) {
    return undefined;
  }
  return trimmedContact;
};

export const normalizeEmailForCustomerMatch = (email: string): string =>
  email.trim().toLowerCase();

const isNonEmptyCustomerId = (
  customerId: string | null | undefined,
): customerId is string =>
  typeof customerId === "string" && customerId.trim().length > 0;

type RazorpayThrownErrorShape = {
  statusCode?: number;
  error?: {
    code?: string;
    description?: string;
  };
};

export const isRazorpayDuplicateCustomerError = (
  thrownValue: unknown,
): boolean => {
  if (typeof thrownValue !== "object" || thrownValue === null) {
    return false;
  }
  const shaped = thrownValue as RazorpayThrownErrorShape;
  const description = shaped.error?.description?.toLowerCase() ?? "";
  return (
    shaped.statusCode === 400 &&
    shaped.error?.code === "BAD_REQUEST_ERROR" &&
    description.includes("customer already exists")
  );
};

export type RazorpayCustomerSummary = {
  id: string;
  email: string;
  name: string;
};

export type GetOrCreateRazorpayCustomerInput = {
  user: {
    _id: Types.ObjectId | string;
    email: string;
    fullName: string;
    razorpayCustomerId?: string | null;
    contact?: string | null;
  };
};

const persistRazorpayCustomerIdOnUser = async (
  userId: Types.ObjectId | string,
  customerId: string,
): Promise<void> => {
  await UserModel.updateOne(
    { _id: userId },
    { $set: { razorpayCustomerId: customerId } },
  );
};

const mapFetchedCustomerToSummary = (
  customer: {
    id: string;
    email?: string;
    name?: string;
  },
  fallbackEmail: string,
  fallbackName: string,
): RazorpayCustomerSummary => ({
  id: customer.id,
  email: customer.email ?? fallbackEmail,
  name: customer.name ?? fallbackName,
});

export const fetchRazorpayCustomer = async (
  customerId: string,
): Promise<RazorpayCustomerSummary> => {
  const razorpayClient = getRazorpayClient();
  try {
    const fetchedCustomer = await razorpayClient.customers.fetch(customerId);
    return mapFetchedCustomerToSummary(
      fetchedCustomer,
      fetchedCustomer.email ?? "",
      fetchedCustomer.name ?? "",
    );
  } catch (thrownValue) {
    throw mapRazorpayFailureToApiError(
      thrownValue,
      "Unable to fetch Razorpay customer",
    );
  }
};

export const findRazorpayCustomerByEmail = async (
  email: string,
): Promise<RazorpayCustomerSummary | null> => {
  const razorpayClient = getRazorpayClient();
  const normalizedTargetEmail = normalizeEmailForCustomerMatch(email);

  for (let pageIndex = 0; pageIndex < CUSTOMER_LIST_MAX_PAGES; pageIndex += 1) {
    const customerListResponse = await razorpayClient.customers.all({
      count: CUSTOMER_LIST_PAGE_SIZE,
      skip: pageIndex * CUSTOMER_LIST_PAGE_SIZE,
    });

    const matchingCustomer = customerListResponse.items.find(
      (customer) =>
        typeof customer.email === "string" &&
        normalizeEmailForCustomerMatch(customer.email) ===
          normalizedTargetEmail,
    );

    if (matchingCustomer) {
      return mapFetchedCustomerToSummary(
        matchingCustomer,
        email,
        matchingCustomer.name ?? "",
      );
    }

    if (customerListResponse.items.length < CUSTOMER_LIST_PAGE_SIZE) {
      break;
    }
  }

  return null;
};

const createRazorpayCustomerOnApi = async (
  user: GetOrCreateRazorpayCustomerInput["user"],
): Promise<RazorpayCustomerSummary> => {
  const razorpayClient = getRazorpayClient();

  try {
    const createdCustomer = await razorpayClient.customers.create({
      name: user.fullName,
      email: user.email,
      contact: sanitizeContactNumber(user.contact ?? null),
      fail_existing: RAZORPAY_FAIL_EXISTING_RETURN_EXISTING,
      notes: { internalUserId: user._id.toString() },
    });

    return mapFetchedCustomerToSummary(
      createdCustomer,
      user.email,
      user.fullName,
    );
  } catch (thrownValue) {
    if (!isRazorpayDuplicateCustomerError(thrownValue)) {
      throw mapRazorpayFailureToApiError(
        thrownValue,
        "Unable to create Razorpay customer",
      );
    }

    console.warn(
      "[razorpay] customers.create duplicate; falling back to email lookup",
      { userId: user._id.toString(), email: user.email },
    );

    const existingCustomer = await findRazorpayCustomerByEmail(user.email);
    if (!existingCustomer) {
      throw mapRazorpayFailureToApiError(
        thrownValue,
        "Unable to create Razorpay customer",
      );
    }

    return existingCustomer;
  }
};

export const getOrCreateRazorpayCustomer = async (
  parameters: GetOrCreateRazorpayCustomerInput,
): Promise<RazorpayCustomerSummary> => {
  const { user } = parameters;

  if (isNonEmptyCustomerId(user.razorpayCustomerId)) {
    try {
      const existingCustomer = await fetchRazorpayCustomer(
        user.razorpayCustomerId.trim(),
      );
      return existingCustomer;
    } catch {
      console.warn(
        "[razorpay] stored customer id invalid; creating or resolving by email",
        { userId: user._id.toString(), customerId: user.razorpayCustomerId },
      );
    }
  }

  const customerSummary = await createRazorpayCustomerOnApi(user);

  await persistRazorpayCustomerIdOnUser(user._id, customerSummary.id);

  return customerSummary;
};

export type CreateProSubscriptionInput = {
  planId: string;
  totalCount: number;
  startAtUnix?: number;
  customerNotify?: 0 | 1;
  notes?: Record<string, string>;
};

export type CreateProSubscriptionResult = {
  id: string;
  status: string;
  shortUrl: string;
  planId: string;
  totalCount: number;
  startAt: number | null;
  endAt: number | null;
  chargeAt: number | null;
  currentStart: number | null;
  currentEnd: number | null;
  customerId: string | null;
  paidCount: number;
};

export const createProSubscription = async (
  parameters: CreateProSubscriptionInput,
): Promise<CreateProSubscriptionResult> => {
  const razorpayClient = getRazorpayClient();

  const subscriptionCreatePayload: {
    plan_id: string;
    total_count: number;
    customer_notify: 0 | 1;
    notes?: Record<string, string>;
    start_at?: number;
    expire_by?: number;
  } = {
    plan_id: parameters.planId,
    total_count: parameters.totalCount,
    customer_notify: parameters.customerNotify ?? 1,
    notes: parameters.notes,
  };

  if (parameters.startAtUnix !== undefined) {
    subscriptionCreatePayload.start_at = parameters.startAtUnix;
    const nowUnix = Math.floor(Date.now() / 1000);
    const authorizationExpireByUnix =
      nowUnix + SUBSCRIPTION_AUTH_EXPIRE_WINDOW_SECONDS;
    subscriptionCreatePayload.expire_by = Math.max(
      nowUnix + 60 * 60,
      Math.min(authorizationExpireByUnix, parameters.startAtUnix - 60),
    );
  }

  let createdSubscription;
  try {
    createdSubscription = await razorpayClient.subscriptions.create(
      subscriptionCreatePayload,
    );
  } catch (thrownValue) {
    throw mapRazorpayFailureToApiError(
      thrownValue,
      "Unable to create Razorpay subscription",
    );
  }

  return {
    id: createdSubscription.id,
    status: createdSubscription.status,
    shortUrl: createdSubscription.short_url,
    planId: createdSubscription.plan_id,
    totalCount: createdSubscription.total_count,
    startAt: createdSubscription.start_at ?? null,
    endAt: createdSubscription.end_at ?? null,
    chargeAt: createdSubscription.charge_at ?? null,
    currentStart: createdSubscription.current_start ?? null,
    currentEnd: createdSubscription.current_end ?? null,
    customerId: createdSubscription.customer_id ?? null,
    paidCount: createdSubscription.paid_count ?? 0,
  };
};

export const cancelRazorpaySubscription = async (
  subscriptionId: string,
  cancelAtCycleEnd: boolean = true,
): Promise<{ id: string; status: string }> => {
  const razorpayClient = getRazorpayClient();
  const cancelledSubscription = await razorpayClient.subscriptions.cancel(
    subscriptionId,
    cancelAtCycleEnd,
  );
  return {
    id: cancelledSubscription.id,
    status: cancelledSubscription.status,
  };
};

export const fetchRazorpaySubscription = async (
  subscriptionId: string,
): Promise<CreateProSubscriptionResult> => {
  const razorpayClient = getRazorpayClient();
  const fetchedSubscription =
    await razorpayClient.subscriptions.fetch(subscriptionId);
  return {
    id: fetchedSubscription.id,
    status: fetchedSubscription.status,
    shortUrl: fetchedSubscription.short_url,
    planId: fetchedSubscription.plan_id,
    totalCount: fetchedSubscription.total_count,
    startAt: fetchedSubscription.start_at ?? null,
    endAt: fetchedSubscription.end_at ?? null,
    chargeAt: fetchedSubscription.charge_at ?? null,
    currentStart: fetchedSubscription.current_start ?? null,
    currentEnd: fetchedSubscription.current_end ?? null,
    customerId: fetchedSubscription.customer_id ?? null,
    paidCount: fetchedSubscription.paid_count ?? 0,
  };
};

export const verifyRazorpayWebhookSignature = (
  rawBody: string,
  signatureHeader: string,
): boolean => {
  if (!signatureHeader || !rawBody) {
    return false;
  }
  try {
    return Razorpay.validateWebhookSignature(
      rawBody,
      signatureHeader,
      env.RAZORPAY_WEBHOOK_SECRET,
    );
  } catch {
    return false;
  }
};
