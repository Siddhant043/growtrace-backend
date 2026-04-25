import { Router } from 'express'

import {
  forgotPassword,
  login,
  resetPassword,
  signup,
} from '../controllers/auth.controller'
import { asyncHandler } from '../middlewares/asyncHandler'
import { validateRequest } from '../middlewares/validateRequest'
import {
  loginRequestSchema,
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
  signupRequestSchema,
} from '../validators/auth.validator'

const authRouter = Router()

authRouter.post('/signup', validateRequest(signupRequestSchema), asyncHandler(signup))
authRouter.post('/login', validateRequest(loginRequestSchema), asyncHandler(login))
authRouter.post('/forgot-password', validateRequest(forgotPasswordRequestSchema), asyncHandler(forgotPassword))
authRouter.post('/reset-password', validateRequest(resetPasswordRequestSchema), asyncHandler(resetPassword))

export default authRouter
