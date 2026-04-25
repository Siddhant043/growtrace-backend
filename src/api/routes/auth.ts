import { Router } from 'express'

import { login, signup } from '../controllers/auth.controller'
import { asyncHandler } from '../middlewares/asyncHandler'
import { validateRequest } from '../middlewares/validateRequest'
import {
  loginRequestSchema,
  signupRequestSchema,
} from '../validators/auth.validator'

const authRouter = Router()

authRouter.post('/signup', validateRequest(signupRequestSchema), asyncHandler(signup))
authRouter.post('/login', validateRequest(loginRequestSchema), asyncHandler(login))

export default authRouter
