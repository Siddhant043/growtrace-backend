import jwt, { type SignOptions } from 'jsonwebtoken'

import { env } from '../../config/env'
import type { UserType } from '../models/user.model'

export type AuthTokenPayload = {
  sub: string
  email: string
  userType: UserType
}

export const signAuthToken = (payload: AuthTokenPayload): string => {
  const tokenOptions: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  }

  return jwt.sign(payload, env.JWT_SECRET, tokenOptions)
}

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload
}
