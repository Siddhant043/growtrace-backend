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

export type SignupRequestBody = z.infer<typeof signupRequestSchema>['body']
export type LoginRequestBody = z.infer<typeof loginRequestSchema>['body']
