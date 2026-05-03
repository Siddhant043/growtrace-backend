import type { NextFunction, Request, Response } from 'express'

import { UserModel, type UserType } from '../models/user.model.js'
import { verifyAuthToken } from '../utils/jwt.js'

export type AuthenticatedUser = {
  id: string
  email: string
  userType: UserType
}

export type AuthenticatedRequest = Request & {
  authenticatedUser: AuthenticatedUser
}

type ApiError = Error & { statusCode: number }

const createApiError = (message: string, statusCode: number): ApiError => {
  const apiError = new Error(message) as ApiError
  apiError.statusCode = statusCode
  return apiError
}

export const authenticate = async (
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> => {
  const authorizationHeader = request.headers.authorization
  if (!authorizationHeader) {
    next(createApiError('Authorization header is required', 401))
    return
  }

  const [scheme, token] = authorizationHeader.split(' ')
  if (scheme !== 'Bearer' || !token) {
    next(createApiError('Authorization header format must be Bearer <token>', 401))
    return
  }

  let tokenPayload: { sub: string; email: string; userType: UserType }
  try {
    tokenPayload = verifyAuthToken(token)
  } catch {
    next(createApiError('Invalid or expired token', 401))
    return
  }

  const user = await UserModel.findById(tokenPayload.sub).lean()
  if (!user || user.isDeleted) {
    next(createApiError('User not found or deleted', 401))
    return
  }

  ;(request as AuthenticatedRequest).authenticatedUser = {
    id: user._id.toString(),
    email: user.email,
    userType: user.userType,
  }

  next()
}
