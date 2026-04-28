import { z } from 'zod'

const normalizedEmailSchema = z
  .string()
  .trim()
  .email('Email must be a valid email address')
  .transform((email) => email.toLowerCase())

const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Full name must be at least 2 characters long')
  .max(120, 'Full name must be at most 120 characters long')

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(100, 'Password must be at most 100 characters long')

const emailSignupBodySchema = z.object({
  authType: z.literal('email').default('email'),
  fullName: fullNameSchema,
  email: normalizedEmailSchema,
  password: passwordSchema,
})

const googleSignupBodySchema = z.object({
  authType: z.literal('google'),
  idToken: z.string().min(1, 'Google idToken is required'),
  fullName: fullNameSchema.optional(),
})

const emailLoginBodySchema = z.object({
  authType: z.literal('email').default('email'),
  email: normalizedEmailSchema,
  password: z.string().min(1, 'Password is required'),
})

const googleLoginBodySchema = z.object({
  authType: z.literal('google'),
  idToken: z.string().min(1, 'Google idToken is required'),
})

const forgotPasswordBodySchema = z.object({
  email: normalizedEmailSchema,
})

const resetPasswordQuerySchema = z.object({
  secret: z.string().min(1, 'secret is required'),
})

const resetPasswordBodySchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((body) => body.password === body.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

const updatePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((body) => body.newPassword === body.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const signupRequestSchema = z.object({
  body: z.discriminatedUnion('authType', [
    emailSignupBodySchema,
    googleSignupBodySchema,
  ]),
})

export const loginRequestSchema = z.object({
  body: z.discriminatedUnion('authType', [
    emailLoginBodySchema,
    googleLoginBodySchema,
  ]),
})

export const forgotPasswordRequestSchema = z.object({
  body: forgotPasswordBodySchema,
})

export const resetPasswordRequestSchema = z.object({
  query: resetPasswordQuerySchema,
  body: resetPasswordBodySchema,
})

export const updatePasswordRequestSchema = z.object({
  body: updatePasswordBodySchema,
})

export type SignupRequestBody = z.infer<typeof signupRequestSchema>['body']
export type LoginRequestBody = z.infer<typeof loginRequestSchema>['body']
export type ForgotPasswordRequestBody = z.infer<typeof forgotPasswordRequestSchema>['body']
export type ResetPasswordRequestBody = z.infer<typeof resetPasswordRequestSchema>['body']
export type ResetPasswordRequestQuery = z.infer<typeof resetPasswordRequestSchema>['query']
export type UpdatePasswordRequestBody = z.infer<typeof updatePasswordRequestSchema>['body']
