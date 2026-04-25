import bcrypt from "bcryptjs";
import type { Request, Response } from "express";

import { UserModel, type AuthType, type UserType } from "../models/user.model";
import type {
  LoginRequestBody,
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

export const signup = async (
  request: Request<unknown, unknown, SignupRequestBody>,
  response: Response,
): Promise<void> => {
  let createdOrLinkedUser: AuthUserRecord | null = null;

  if (request.body.authType === "google") {
    const verifiedGoogleIdentity = await verifyGoogleIdToken(request.body.idToken).catch(
      () => {
        throw createApiError("Invalid Google authentication token", 401);
      },
    );

    const existingUser = await UserModel.findOne({ email: verifiedGoogleIdentity.email });

    if (existingUser) {
      if (existingUser.isDeleted) {
        throw createApiError("User account is deleted", 403);
      }

      if (
        existingUser.googleSub &&
        existingUser.googleSub !== verifiedGoogleIdentity.googleSub
      ) {
        throw createApiError("Google account is already linked to another identity", 409);
      }

      existingUser.authMethods = mergeAuthMethods(existingUser.authMethods, "google");
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

      const existingMethods = existingUser.authMethods ?? [existingUser.authType ?? "email"];
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
    const verifiedGoogleIdentity = await verifyGoogleIdToken(request.body.idToken).catch(
      () => {
        throw createApiError("Invalid Google authentication token", 401);
      },
    );

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
        throw createApiError("Google account is already linked to another identity", 409);
      }

      existingUser.authMethods = mergeAuthMethods(existingUser.authMethods, "google");
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
      throw createApiError("This account is linked to Google sign-in only", 401);
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
