import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { Types } from "mongoose";

import { env } from "../../config/env";
import {
  sendPasswordResetEmail,
  sendPasswordUpdatedEmail,
} from "../../infrastructure/email";
import { connectToRedis } from "../../infrastructure/redis";
import { UserModel, type AuthType, type UserType } from "../models/user.model";
import type {
  ForgotPasswordRequestBody,
  LoginRequestBody,
  ResetPasswordRequestBody,
  ResetPasswordRequestQuery,
  SignupRequestBody,
} from "../validators/auth.validator";
import { signAuthToken } from "../utils/jwt";
import { verifyGoogleIdToken } from "../utils/googleAuth";

type ApiError = Error & { statusCode: number };
type AuthUserRecord = {
  _id: { toString(): string };
  fullName: string;
  email: string;
  userType: UserType;
  isDeleted: boolean;
  authType?: AuthType;
  authMethods?: AuthType[];
  password?: string;
  googleSub?: string;
  emailVerified?: boolean;
  save: () => Promise<unknown>;
};

const createApiError = (message: string, statusCode: number): ApiError => {
  const apiError = new Error(message) as ApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

const mapUserForAuthResponse = (user: {
  _id: { toString(): string };
  fullName: string;
  email: string;
  userType: UserType;
  isDeleted: boolean;
  authType?: AuthType;
  authMethods?: AuthType[];
}) => ({
  id: user._id.toString(),
  fullName: user.fullName,
  email: user.email,
  userType: user.userType,
  isDeleted: user.isDeleted,
  authType: user.authType ?? "email",
  authMethods: user.authMethods ?? [user.authType ?? "email"],
});

const mergeAuthMethods = (
  currentMethods: AuthType[] | undefined,
  authMethodToAdd: AuthType,
): AuthType[] => {
  const mergedMethods = new Set<AuthType>(currentMethods ?? []);
  mergedMethods.add(authMethodToAdd);
  return [...mergedMethods];
};

const RESET_SECRET_TTL_SECONDS = 10 * 60;
const PASSWORD_RESET_KEY_PREFIX = "pwd-reset";

const getPasswordResetRedisKey = (resetSecret: string): string =>
  `${PASSWORD_RESET_KEY_PREFIX}:${resetSecret}`;

export const signup = async (
  request: Request<unknown, unknown, SignupRequestBody>,
  response: Response,
): Promise<void> => {
  let createdOrLinkedUser: AuthUserRecord | null = null;

  if (request.body.authType === "google") {
    const verifiedGoogleIdentity = await verifyGoogleIdToken(
      request.body.idToken,
    ).catch(() => {
      throw createApiError("Invalid Google authentication token", 401);
    });

    const existingUser = await UserModel.findOne({
      email: verifiedGoogleIdentity.email,
    });

    if (existingUser) {
      if (existingUser.isDeleted) {
        throw createApiError("User account is deleted", 403);
      }

      if (
        existingUser.googleSub &&
        existingUser.googleSub !== verifiedGoogleIdentity.googleSub
      ) {
        throw createApiError(
          "Google account is already linked to another identity",
          409,
        );
      }

      existingUser.authMethods = mergeAuthMethods(
        existingUser.authMethods,
        "google",
      );
      existingUser.googleSub = verifiedGoogleIdentity.googleSub;
      existingUser.emailVerified =
        existingUser.emailVerified || verifiedGoogleIdentity.emailVerified;
      existingUser.authType = existingUser.authType ?? "email";
      if (!existingUser.fullName?.trim().length) {
        existingUser.fullName = verifiedGoogleIdentity.fullName;
      }

      await existingUser.save();
      createdOrLinkedUser = existingUser as unknown as AuthUserRecord;
    } else {
      createdOrLinkedUser = (await UserModel.create({
        fullName: request.body.fullName?.trim().length
          ? request.body.fullName
          : verifiedGoogleIdentity.fullName,
        email: verifiedGoogleIdentity.email,
        userType: "normal",
        isDeleted: false,
        authType: "google",
        authMethods: ["google"],
        googleSub: verifiedGoogleIdentity.googleSub,
        emailVerified: verifiedGoogleIdentity.emailVerified,
      })) as unknown as AuthUserRecord;
    }
  } else {
    const { fullName, email, password } = request.body;
    const existingUser = await UserModel.findOne({ email });

    if (existingUser) {
      if (existingUser.isDeleted) {
        throw createApiError("User account is deleted", 403);
      }

      const existingMethods = existingUser.authMethods ?? [
        existingUser.authType ?? "email",
      ];
      if (existingMethods.includes("email")) {
        throw createApiError("Email is already registered", 409);
      }

      existingUser.password = await bcrypt.hash(password, 10);
      existingUser.authMethods = mergeAuthMethods(existingMethods, "email");
      existingUser.authType = "email";
      existingUser.fullName = fullName;
      await existingUser.save();
      createdOrLinkedUser = existingUser as unknown as AuthUserRecord;
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      createdOrLinkedUser = (await UserModel.create({
        fullName,
        email,
        password: passwordHash,
        userType: "normal",
        isDeleted: false,
        authType: "email",
        authMethods: ["email"],
      })) as unknown as AuthUserRecord;
    }
  }

  if (!createdOrLinkedUser) {
    throw createApiError("Unable to process signup request", 500);
  }

  const token = signAuthToken({
    sub: createdOrLinkedUser._id.toString(),
    email: createdOrLinkedUser.email,
    userType: createdOrLinkedUser.userType,
  });

  response.status(201).json({
    success: true,
    token,
    user: mapUserForAuthResponse(createdOrLinkedUser),
  });
};

export const login = async (
  request: Request<unknown, unknown, LoginRequestBody>,
  response: Response,
): Promise<void> => {
  let authenticatedUser: AuthUserRecord | null = null;

  if (request.body.authType === "google") {
    const verifiedGoogleIdentity = await verifyGoogleIdToken(
      request.body.idToken,
    ).catch(() => {
      throw createApiError("Invalid Google authentication token", 401);
    });

    const existingUser = await UserModel.findOne({
      email: verifiedGoogleIdentity.email,
    }).select("+password");

    if (existingUser) {
      if (existingUser.isDeleted) {
        throw createApiError("User account is deleted", 403);
      }

      if (
        existingUser.googleSub &&
        existingUser.googleSub !== verifiedGoogleIdentity.googleSub
      ) {
        throw createApiError(
          "Google account is already linked to another identity",
          409,
        );
      }

      existingUser.authMethods = mergeAuthMethods(
        existingUser.authMethods,
        "google",
      );
      existingUser.googleSub = verifiedGoogleIdentity.googleSub;
      existingUser.emailVerified =
        existingUser.emailVerified || verifiedGoogleIdentity.emailVerified;
      if (!existingUser.authType) {
        existingUser.authType = "google";
      }
      if (!existingUser.fullName?.trim().length) {
        existingUser.fullName = verifiedGoogleIdentity.fullName;
      }

      await existingUser.save();
      authenticatedUser = existingUser as unknown as AuthUserRecord;
    } else {
      authenticatedUser = (await UserModel.create({
        fullName: verifiedGoogleIdentity.fullName,
        email: verifiedGoogleIdentity.email,
        userType: "normal",
        isDeleted: false,
        authType: "google",
        authMethods: ["google"],
        googleSub: verifiedGoogleIdentity.googleSub,
        emailVerified: verifiedGoogleIdentity.emailVerified,
      })) as unknown as AuthUserRecord;
    }
  } else {
    const { email, password } = request.body;
    const user = await UserModel.findOne({ email }).select("+password");
    if (!user) {
      throw createApiError("Invalid email or password", 401);
    }

    if (user.isDeleted) {
      throw createApiError("User account is deleted", 403);
    }

    const availableAuthMethods = user.authMethods ?? [user.authType ?? "email"];
    if (!availableAuthMethods.includes("email")) {
      throw createApiError(
        "This account is linked to Google sign-in only",
        401,
      );
    }

    if (!user.password) {
      throw createApiError("Password is not set for this account", 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw createApiError("Invalid email or password", 401);
    }

    authenticatedUser = user as unknown as AuthUserRecord;
  }

  if (!authenticatedUser) {
    throw createApiError("Unable to process login request", 500);
  }

  const token = signAuthToken({
    sub: authenticatedUser._id.toString(),
    email: authenticatedUser.email,
    userType: authenticatedUser.userType,
  });

  response.status(200).json({
    success: true,
    token,
    user: mapUserForAuthResponse(authenticatedUser),
  });
};

export const forgotPassword = async (
  request: Request<unknown, unknown, ForgotPasswordRequestBody>,
  response: Response,
): Promise<void> => {
  const { email } = request.body;
  const user = await UserModel.findOne({ email });

  if (user && !user.isDeleted) {
    const resetSecret = randomBytes(32).toString("hex");
    const redisClient = await connectToRedis();
    const resetSecretRedisKey = getPasswordResetRedisKey(resetSecret);

    await redisClient.set(
      resetSecretRedisKey,
      JSON.stringify({
        userId: user._id.toString(),
      }),
      "EX",
      RESET_SECRET_TTL_SECONDS,
    );

    const resetLink = `${env.CLIENT_APP_URL}/reset-password?secret=${encodeURIComponent(resetSecret)}`;

    try {
      const emailObject = {
        from: env.SMTP_FROM,
        to: user.email,
        subject: "GrowTrace password reset",
        text: `Use this link to reset your password. This link is valid for 10 minutes: ${resetLink}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
            <h2 style="margin: 0 0 12px;">Reset your GrowTrace password</h2>
            <p style="margin: 0 0 12px;">You requested a password reset.</p>
            <p style="margin: 0 0 12px;">
              <a href="${resetLink}" style="color: #4f46e5; text-decoration: none;">Reset Password</a>
            </p>
            <p style="margin: 0;">This link expires in 10 minutes.</p>
          </div>
        `,
      };
      await sendPasswordResetEmail(emailObject);
    } catch (emailError) {
      console.error("Failed to send password reset email", emailError);
    }
  }

  response.status(200).json({
    success: true,
    message: "If an account exists, reset instructions were sent.",
  });
};

export const resetPassword = async (
  request: Request<
    unknown,
    unknown,
    ResetPasswordRequestBody,
    ResetPasswordRequestQuery
  >,
  response: Response,
): Promise<void> => {
  const { secret } = request.query;
  const { password } = request.body;
  const redisClient = await connectToRedis();
  const resetSecretRedisKey = getPasswordResetRedisKey(secret);
  const resetSecretRecord = await redisClient.get(resetSecretRedisKey);

  if (!resetSecretRecord) {
    throw createApiError("Reset secret is invalid or expired", 401);
  }

  let parsedSecretRecord: { userId: string };
  try {
    parsedSecretRecord = JSON.parse(resetSecretRecord) as { userId: string };
  } catch {
    await redisClient.del(resetSecretRedisKey);
    throw createApiError("Reset secret is invalid or expired", 401);
  }

  if (
    !parsedSecretRecord.userId ||
    !Types.ObjectId.isValid(parsedSecretRecord.userId)
  ) {
    await redisClient.del(resetSecretRedisKey);
    throw createApiError("Reset secret is invalid or expired", 401);
  }

  const user = await UserModel.findById(parsedSecretRecord.userId).select(
    "+password",
  );
  if (!user || user.isDeleted) {
    await redisClient.del(resetSecretRedisKey);
    throw createApiError("Reset secret is invalid or expired", 401);
  }

  const availableAuthMethods = user.authMethods ?? [user.authType ?? "email"];
  if (!availableAuthMethods.includes("email")) {
    throw createApiError("This account is linked to Google sign-in only", 401);
  }

  user.password = await bcrypt.hash(password, 10);
  user.authType = "email";
  user.authMethods = mergeAuthMethods(availableAuthMethods, "email");
  await user.save();
  await redisClient.del(resetSecretRedisKey);

  try {
    const passwordUpdatedEmailObject = {
      from: env.SMTP_FROM,
      to: user.email,
      subject: "GrowTrace password updated",
      text: "Your GrowTrace password has been updated successfully. If this was not you, please reset your password immediately.",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin: 0 0 12px;">Your password was updated</h2>
          <p style="margin: 0 0 12px;">Your GrowTrace password has been changed successfully.</p>
          <p style="margin: 0;">If you did not make this change, please reset your password immediately and review your account security.</p>
        </div>
      `,
    };

    await sendPasswordUpdatedEmail(passwordUpdatedEmailObject);
  } catch (emailError) {
    console.error("Failed to send password updated email", emailError);
  }

  response.status(200).json({
    success: true,
    message: "Password reset successful.",
  });
};
