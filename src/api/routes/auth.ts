import { Router } from 'express'

import {
  forgotPassword,
  login,
  resetPassword,
  signup,
} from '../controllers/auth.controller.js'
import { asyncHandler } from '../middlewares/asyncHandler.js'
import { validateRequest } from '../middlewares/validateRequest.js'
import {
  loginRequestSchema,
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
  signupRequestSchema,
} from '../validators/auth.validator.js'

const authRouter = Router()

authRouter.post('/signup', validateRequest(signupRequestSchema), asyncHandler(signup))
authRouter.post('/login', validateRequest(loginRequestSchema), asyncHandler(login))
authRouter.post('/forgot-password', validateRequest(forgotPasswordRequestSchema), asyncHandler(forgotPassword))
authRouter.post('/reset-password', validateRequest(resetPasswordRequestSchema), asyncHandler(resetPassword))

export default authRouter
