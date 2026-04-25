import type { NextFunction, Request, Response } from 'express'

type ErrorWithStatusCode = Error & {
  statusCode?: number
}

export const errorHandler = (
  error: ErrorWithStatusCode,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void => {
  const statusCode = error.statusCode ?? 500
  const isServerError = statusCode >= 500

  response.status(statusCode).json({
    success: false,
    message: isServerError ? 'Internal server error' : error.message,
  })
}
