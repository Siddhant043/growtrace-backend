import type { NextFunction, Request, Response } from 'express'
import { captureSystemError } from '../../services/systemMonitoring.errorLog.service.js'

type ErrorWithStatusCode = Error & {
  statusCode?: number
  code?: string
  details?: Record<string, unknown>
}

const resolveErrorMessage = (error: ErrorWithStatusCode): string => {
  if (typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }

  const razorpayDescription = (
    error as ErrorWithStatusCode & {
      error?: { description?: string };
    }
  ).error?.description;

  if (typeof razorpayDescription === "string" && razorpayDescription.trim()) {
    return razorpayDescription;
  }

  return "Request failed";
};

export const errorHandler = (
  error: ErrorWithStatusCode,
  request: Request,
  response: Response,
  _next: NextFunction,
): void => {
  const statusCode = error.statusCode ?? 500
  const isServerError = statusCode >= 500
  const resolvedMessage = resolveErrorMessage(error)

  void captureSystemError({
    source: 'api',
    service: 'express-api',
    severity: statusCode >= 500 ? 'high' : 'medium',
    message: resolvedMessage,
    stack: error.stack ?? null,
    metadata: {
      method: request.method,
      path: request.originalUrl,
      statusCode,
      code: error.code,
      details: error.details,
    },
  })

  const responseBody: {
    success: false
    message: string
    code?: string
    details?: Record<string, unknown>
  } = {
    success: false,
    message: isServerError ? 'Internal server error' : resolvedMessage,
  }

  if (!isServerError && error.code) {
    responseBody.code = error.code
  }
  if (!isServerError && error.details) {
    responseBody.details = error.details
  }

  response.status(statusCode).json(responseBody)
}
