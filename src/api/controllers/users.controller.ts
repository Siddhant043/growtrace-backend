import bcrypt from 'bcryptjs'
import type { Request, Response } from 'express'

import { UserModel } from '../models/user.model.js'
import type { AuthenticatedRequest } from '../middlewares/authenticate.js'
import { getEffectivePlanForUser } from '../../services/planInfo.service.js'
import type { UpdatePasswordRequestBody } from '../validators/auth.validator.js'

const mapUserProfileResponse = (user: {
  _id: { toString(): string }
  fullName: string
  email: string
  userType: 'normal' | 'superadmin'
  isDeleted: boolean
  imageUrl?: string | null
  subscriptionStartDate?: Date | null
  subscriptionEndDate?: Date | null
  isLifetimeSubscription?: boolean
  isSubscriptionActive?: boolean
}) => ({
  id: user._id.toString(),
  fullName: user.fullName,
  email: user.email,
  userType: user.userType,
  isDeleted: user.isDeleted,
  imageUrl: user.imageUrl ?? null,
  subscriptionStartDate: user.subscriptionStartDate ?? null,
  subscriptionEndDate: user.subscriptionEndDate ?? null,
  isLifetimeSubscription: user.isLifetimeSubscription ?? false,
  isSubscriptionActive: user.isSubscriptionActive ?? false,
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

export const updateCurrentUserPassword = async (
  request: Request<unknown, unknown, UpdatePasswordRequestBody>,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = request as AuthenticatedRequest
  const { currentPassword, newPassword } = request.body

  const user = await UserModel.findById(authenticatedRequest.authenticatedUser.id).select(
    '+password',
  )

  if (!user || user.isDeleted) {
    throw createApiError('User not found or deleted', 404)
  }

  const availableAuthMethods = user.authMethods ?? [user.authType ?? 'email']
  if (!availableAuthMethods.includes('email')) {
    throw createApiError('This account is linked to Google sign-in only', 400)
  }

  if (!user.password) {
    throw createApiError('Password is not set for this account', 400)
  }

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
  if (!isCurrentPasswordValid) {
    throw createApiError('Current password is incorrect', 401)
  }

  user.password = await bcrypt.hash(newPassword, 10)
  user.authMethods = availableAuthMethods
  user.authType = user.authType ?? 'email'
  await user.save()

  response.status(200).json({
    success: true,
    message: 'Password updated successfully.',
  })
}

export const getCurrentUserPlan = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const authenticatedRequest = request as AuthenticatedRequest
  const planInfo = await getEffectivePlanForUser(
    authenticatedRequest.authenticatedUser.id,
  )

  response.status(200).json({
    success: true,
    data: {
      plan: planInfo.plan,
      status: planInfo.status,
      features: planInfo.features,
      currentPeriodEnd: planInfo.currentPeriodEnd,
      cancelAtCycleEnd: planInfo.cancelAtCycleEnd,
      lifetime: planInfo.lifetime,
      manage: planInfo.manage,
    },
  })
}
