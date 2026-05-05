import type { NextFunction, Request, Response } from 'express'
import { captureSystemError } from '../../services/systemMonitoring.errorLog.service.js'

type ErrorWithStatusCode = Error & {
  statusCode?: number
  code?: string
  details?: Record<string, unknown>
}

export const errorHandler = (
  error: ErrorWithStatusCode,
  request: Request,
  response: Response,
  _next: NextFunction,
): void => {
  const statusCode = error.statusCode ?? 500
  const isServerError = statusCode >= 500

  void captureSystemError({
    source: 'api',
    service: 'express-api',
    severity: statusCode >= 500 ? 'high' : 'medium',
    message: error.message || 'Unknown API error',
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
    message: isServerError ? 'Internal server error' : error.message,
  }

  if (!isServerError && error.code) {
    responseBody.code = error.code
  }
  if (!isServerError && error.details) {
    responseBody.details = error.details
  }

  response.status(statusCode).json(responseBody)
}
