import type { Request, Response } from 'express'

import { UserModel } from '../models/user.model'
import type { AuthenticatedRequest } from '../middlewares/authenticate'

const mapUserProfileResponse = (user: {
  _id: { toString(): string }
  fullName: string
  email: string
  userType: 'normal' | 'superadmin'
  isDeleted: boolean
}) => ({
  id: user._id.toString(),
  fullName: user.fullName,
  email: user.email,
  userType: user.userType,
  isDeleted: user.isDeleted,
})

type ApiError = Error & { statusCode: number }

const createApiError = (message: string, statusCode: number): ApiError => {
  const apiError = new Error(message) as ApiError
  apiError.statusCode = statusCode
  return apiError
}

export const getCurrentUserProfile = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = request as AuthenticatedRequest
  const user = await UserModel.findById(authenticatedRequest.authenticatedUser.id).lean()

  if (!user || user.isDeleted) {
    throw createApiError('User not found or deleted', 404)
  }

  response.status(200).json({
    success: true,
    user: mapUserProfileResponse(user),
  })
}
