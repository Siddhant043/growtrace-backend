import type { NextFunction, Request, Response } from 'express'

type ErrorWithStatusCode = Error & {
  statusCode?: number
  code?: string
  details?: Record<string, unknown>
}

export const errorHandler = (
  error: ErrorWithStatusCode,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void => {
  const statusCode = error.statusCode ?? 500
  const isServerError = statusCode >= 500

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
