import { model, Schema, type InferSchemaType, type Types } from "mongoose";

import {
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_TYPES,
  type SubscriptionStatus,
  type SubscriptionType,
} from "./user.model.js";

export const SUBSCRIPTION_BILLING_INTERVALS = ["monthly", "yearly"] as const;
export type SubscriptionBillingInterval =
  (typeof SUBSCRIPTION_BILLING_INTERVALS)[number];

export const SUBSCRIPTION_PROMO_TYPES = ["first_month_free"] as const;
export type SubscriptionPromoType = (typeof SUBSCRIPTION_PROMO_TYPES)[number];

export const SUBSCRIPTION_BILLING_REGIONS = [
  "domestic",
  "international",
] as const;
export type SubscriptionBillingRegion =
  (typeof SUBSCRIPTION_BILLING_REGIONS)[number];

export const SUBSCRIPTION_BILLING_CURRENCIES = ["INR", "USD"] as const;
export type SubscriptionBillingCurrency =
  (typeof SUBSCRIPTION_BILLING_CURRENCIES)[number];

const subscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    plan: {
      type: String,
      enum: SUBSCRIPTION_TYPES,
      required: true,
      default: "pro",
    },
    billingInterval: {
      type: String,
      enum: SUBSCRIPTION_BILLING_INTERVALS,
      required: true,
      default: "monthly",
    },
    billingRegion: {
      type: String,
      enum: SUBSCRIPTION_BILLING_REGIONS,
      required: true,
      default: "domestic",
    },
    currency: {
      type: String,
      enum: SUBSCRIPTION_BILLING_CURRENCIES,
      required: true,
      default: "INR",
    },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      required: true,
      default: "created",
    },
    razorpaySubscriptionId: {
      type: String,
      required: true,
      trim: true,
    },
    razorpayPlanId: {
      type: String,
      required: true,
      trim: true,
    },
    razorpayCustomerId: {
      type: String,
      required: true,
      trim: true,
    },
    currentStart: {
      type: Date,
      default: null,
    },
    currentEnd: {
      type: Date,
      default: null,
    },
    chargeAt: {
      type: Date,
      default: null,
    },
    startAt: {
      type: Date,
      default: null,
    },
    endAt: {
      type: Date,
      default: null,
    },
    paidCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shortUrl: {
      type: String,
      default: null,
      trim: true,
    },
    cancelAtCycleEnd: {
      type: Boolean,
      default: false,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    lastEventId: {
      type: String,
      default: null,
      trim: true,
    },
    lastEventAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: Schema.Types.Mixed,
      default: null,
    },
    promoType: {
      type: String,
      enum: SUBSCRIPTION_PROMO_TYPES,
      default: null,
    },
    promoTrialEndsAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "subscriptions",
  },
);

subscriptionSchema.index(
  { razorpaySubscriptionId: 1 },
  { unique: true, name: "uniq_razorpay_subscription_id" },
);
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ userId: 1, createdAt: -1 });
subscriptionSchema.index({ status: 1, currentEnd: 1 });

export type SubscriptionDocument = InferSchemaType<typeof subscriptionSchema> & {
  _id: Types.ObjectId;
};

export const SubscriptionModel = model("Subscription", subscriptionSchema);

export type { SubscriptionStatus, SubscriptionType };
