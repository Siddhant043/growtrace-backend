import crypto from "crypto";
import type { Request, Response } from "express";

import { verifyRazorpayWebhookSignature } from "../../infrastructure/razorpay.js";
import {
  isHandledRazorpayEvent,
  processRazorpayLifecycleEvent,
  type HandledRazorpayEvent,
  type RazorpayLifecycleEventInput,
} from "../../services/subscriptionLifecycle.service.js";
import { RazorpayWebhookEventModel } from "../models/razorpayWebhookEvent.model.js";

type RawBodyAwareRequest = Request & { rawBody?: Buffer | string };

type RazorpayWebhookPayload = {
  event?: string;
  created_at?: number;
  payload?: {
    subscription?: { entity?: Record<string, unknown> };
    payment?: { entity?: Record<string, unknown> };
  };
};

const buildPayloadHash = (rawBody: string): string =>
  crypto.createHash("sha256").update(rawBody).digest("hex");

const resolveRawBodyString = (request: RawBodyAwareRequest): string | null => {
  const rawBody = request.rawBody;
  if (Buffer.isBuffer(rawBody)) {
    return rawBody.toString("utf8");
  }
  if (typeof rawBody === "string") {
    return rawBody;
  }
  return null;
};

const resolveEventIdFromHeaderOrPayload = (
  request: Request,
  payloadHash: string,
): string => {
  const headerEventId = request.header("x-razorpay-event-id");
  if (headerEventId && headerEventId.trim().length > 0) {
    return headerEventId.trim();
  }
  return `payload_hash:${payloadHash}`;
};

const extractSubscriptionEntity = (
  payload: RazorpayWebhookPayload,
): Record<string, unknown> | undefined => payload.payload?.subscription?.entity;

const extractPaymentEntity = (
  payload: RazorpayWebhookPayload,
): Record<string, unknown> | undefined => payload.payload?.payment?.entity;

const extractSubscriptionIdFromEvent = (
  payload: RazorpayWebhookPayload,
): string | null => {
  const subscriptionEntity = extractSubscriptionEntity(payload);
  if (
    subscriptionEntity &&
    typeof subscriptionEntity.id === "string" &&
    subscriptionEntity.id.length > 0
  ) {
    return subscriptionEntity.id;
  }
  const paymentEntity = extractPaymentEntity(payload);
  if (
    paymentEntity &&
    typeof paymentEntity.subscription_id === "string" &&
    paymentEntity.subscription_id.length > 0
  ) {
    return paymentEntity.subscription_id;
  }
  return null;
};

const ACK_RESPONSE_BODY = { received: true } as const;

export const handleRazorpayWebhook = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const rawBodyAwareRequest = request as RawBodyAwareRequest;
  const rawBodyString = resolveRawBodyString(rawBodyAwareRequest);

  if (!rawBodyString) {
    response.status(400).json({
      success: false,
      message: "Missing raw body for webhook verification",
    });
    return;
  }

  const signatureHeader = request.header("x-razorpay-signature") ?? "";
  const isSignatureValid = verifyRazorpayWebhookSignature(
    rawBodyString,
    signatureHeader,
  );

  if (!isSignatureValid) {
    response.status(401).json({
      success: false,
      message: "Invalid webhook signature",
    });
    return;
  }

  let parsedPayload: RazorpayWebhookPayload;
  try {
    parsedPayload = JSON.parse(rawBodyString) as RazorpayWebhookPayload;
  } catch {
    response.status(400).json({
      success: false,
      message: "Invalid JSON payload",
    });
    return;
  }

  const eventName = parsedPayload.event;
  if (!eventName || typeof eventName !== "string") {
    response.status(400).json({
      success: false,
      message: "Missing event name",
    });
    return;
  }

  const payloadHash = buildPayloadHash(rawBodyString);
  const eventId = resolveEventIdFromHeaderOrPayload(request, payloadHash);
  const occurredAtSeconds =
    typeof parsedPayload.created_at === "number"
      ? parsedPayload.created_at
      : null;
  const occurredAt = occurredAtSeconds
    ? new Date(occurredAtSeconds * 1000)
    : new Date();

  const relatedSubscriptionId = extractSubscriptionIdFromEvent(parsedPayload);

  let eventLog;
  try {
    eventLog = await RazorpayWebhookEventModel.create({
      eventId,
      event: eventName,
      payloadHash,
      status: "received",
      receivedAt: new Date(),
      relatedSubscriptionId,
    });
  } catch (creationError) {
    if (
      creationError &&
      typeof creationError === "object" &&
      "code" in creationError &&
      (creationError as { code?: number }).code === 11000
    ) {
      response.status(200).json({
        ...ACK_RESPONSE_BODY,
        duplicate: true,
      });
      return;
    }
    throw creationError;
  }

  if (!isHandledRazorpayEvent(eventName)) {
    await RazorpayWebhookEventModel.updateOne(
      { _id: eventLog._id },
      {
        $set: {
          status: "skipped",
          processedAt: new Date(),
          error: "unhandled_event",
        },
      },
    );
    response.status(200).json({
      ...ACK_RESPONSE_BODY,
      handled: false,
    });
    return;
  }

  const subscriptionEntity = extractSubscriptionEntity(parsedPayload);
  const paymentEntity = extractPaymentEntity(parsedPayload);

  const lifecycleEventInput: RazorpayLifecycleEventInput = {
    eventId,
    event: eventName as HandledRazorpayEvent,
    occurredAt,
    subscription: subscriptionEntity as RazorpayLifecycleEventInput["subscription"],
    payment: paymentEntity as RazorpayLifecycleEventInput["payment"],
  };

  try {
    const result = await processRazorpayLifecycleEvent(lifecycleEventInput);
    await RazorpayWebhookEventModel.updateOne(
      { _id: eventLog._id },
      {
        $set: {
          status: result.kind === "applied" ? "processed" : "skipped",
          processedAt: new Date(),
          error: result.kind === "skipped" ? result.reason : null,
        },
      },
    );
    response.status(200).json({
      ...ACK_RESPONSE_BODY,
      handled: true,
      result,
    });
  } catch (processingError) {
    const errorMessage =
      processingError instanceof Error
        ? processingError.message
        : "Unknown processing error";
    await RazorpayWebhookEventModel.updateOne(
      { _id: eventLog._id },
      {
        $set: {
          status: "failed",
          processedAt: new Date(),
          error: errorMessage,
        },
      },
    );
    throw processingError;
  }
};
