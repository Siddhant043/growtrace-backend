import type { Request, Response } from 'express'

export const notFoundHandler = (request: Request, response: Response): void => {
  response.status(404).json({
    success: false,
    message: `Route not found: ${request.originalUrl}`,
  })
}
