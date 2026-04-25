import type { NextFunction, Request, Response } from 'express'
import type { ZodSchema } from 'zod'

type RequestPayload = {
  body?: unknown
  params?: unknown
  query?: unknown
}

type ValidationTargets = {
  body?: unknown
  params?: unknown
  query?: unknown
}

const createValidationError = (message: string): Error & { statusCode: number } => {
  const validationError = new Error(message) as Error & { statusCode: number }
  validationError.statusCode = 400
  return validationError
}

export const validateRequest =
  (schema: ZodSchema<RequestPayload>) =>
  (request: Request, _response: Response, next: NextFunction): void => {
    const validationTargets: ValidationTargets = {
      body: request.body,
      params: request.params,
      query: request.query,
    }

    const parsedPayload = schema.safeParse(validationTargets)

    if (!parsedPayload.success) {
      const errorMessage = parsedPayload.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ')
      next(createValidationError(errorMessage))
      return
    }

    if (parsedPayload.data.body !== undefined) {
      request.body = parsedPayload.data.body
    }
    if (parsedPayload.data.params !== undefined) {
      request.params = parsedPayload.data.params as Request['params']
    }
    if (parsedPayload.data.query !== undefined) {
      request.query = parsedPayload.data.query as Request['query']
    }
    next()
  }
