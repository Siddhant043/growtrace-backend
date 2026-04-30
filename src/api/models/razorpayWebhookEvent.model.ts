import { model, Schema, type InferSchemaType, type Types } from "mongoose";

export const RAZORPAY_WEBHOOK_EVENT_STATUSES = [
  "received",
  "processed",
  "failed",
  "skipped",
] as const;
export type RazorpayWebhookEventStatus =
  (typeof RAZORPAY_WEBHOOK_EVENT_STATUSES)[number];

const razorpayWebhookEventSchema = new Schema(
  {
    eventId: {
      type: String,
      required: true,
      trim: true,
    },
    event: {
      type: String,
      required: true,
      trim: true,
    },
    payloadHash: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: RAZORPAY_WEBHOOK_EVENT_STATUSES,
      required: true,
      default: "received",
    },
    receivedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    processedAt: {
      type: Date,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
    relatedSubscriptionId: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "razorpay_webhook_events",
  },
);

razorpayWebhookEventSchema.index(
  { eventId: 1 },
  { unique: true, name: "uniq_event_id" },
);
razorpayWebhookEventSchema.index({ event: 1, receivedAt: -1 });
razorpayWebhookEventSchema.index({ status: 1, receivedAt: -1 });

export type RazorpayWebhookEventDocument = InferSchemaType<
  typeof razorpayWebhookEventSchema
> & {
  _id: Types.ObjectId;
};

export const RazorpayWebhookEventModel = model(
  "RazorpayWebhookEvent",
  razorpayWebhookEventSchema,
);
