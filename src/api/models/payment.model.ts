import { model, Schema, type InferSchemaType, type Types } from "mongoose";

export const PAYMENT_STATUSES = ["success", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["card", "upi", "netbanking", "wallet", "emi"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const paymentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      required: false,
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      required: true,
      trim: true,
    },
    razorpayOrderId: {
      type: String,
      required: false,
      default: null,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "INR",
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
    },
    method: {
      type: String,
      required: false,
      default: null,
    },
    failureReason: {
      type: String,
      required: false,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "payments",
  },
);

paymentSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, name: "uniq_razorpay_payment_id" },
);
paymentSchema.index({ userId: 1 }, { name: "payment_user_id_idx" });
paymentSchema.index(
  { subscriptionId: 1 },
  { name: "payment_subscription_id_idx", sparse: true },
);
paymentSchema.index({ status: 1 }, { name: "payment_status_idx" });
paymentSchema.index({ createdAt: -1 }, { name: "payment_created_at_desc_idx" });

export type PaymentDocument = InferSchemaType<typeof paymentSchema> & {
  _id: Types.ObjectId;
};

export const PaymentModel = model("Payment", paymentSchema);

