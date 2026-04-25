import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const {
  findOneMock,
  findByIdMock,
  hashMock,
  sendPasswordResetEmailMock,
  connectToRedisMock,
  redisGetMock,
  redisSetMock,
  redisDelMock,
} = vi.hoisted(() => ({
  findOneMock: vi.fn(),
  findByIdMock: vi.fn(),
  hashMock: vi.fn(),
  sendPasswordResetEmailMock: vi.fn(),
  connectToRedisMock: vi.fn(),
  redisGetMock: vi.fn(),
  redisSetMock: vi.fn(),
  redisDelMock: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: hashMock,
    compare: vi.fn(),
  },
}));

vi.mock("../../src/api/models/user.model", () => ({
  UserModel: {
    findOne: findOneMock,
    findById: findByIdMock,
  },
}));

vi.mock("../../src/infrastructure/email", () => ({
  sendPasswordResetEmail: sendPasswordResetEmailMock,
}));

vi.mock("../../src/infrastructure/redis", () => ({
  connectToRedis: connectToRedisMock,
}));

import {
  forgotPassword,
  resetPassword,
} from "../../src/api/controllers/auth.controller";

type MockResponse = Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
};

const createMockResponse = (): MockResponse => {
  const response = {} as MockResponse;
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response;
};

describe("auth forgot/reset password controller", () => {
  beforeEach(() => {
    findOneMock.mockReset();
    findByIdMock.mockReset();
    hashMock.mockReset();
    sendPasswordResetEmailMock.mockReset();
    connectToRedisMock.mockReset();
    redisGetMock.mockReset();
    redisSetMock.mockReset();
    redisDelMock.mockReset();

    connectToRedisMock.mockResolvedValue({
      set: redisSetMock,
      get: redisGetMock,
      del: redisDelMock,
    });
  });

  it("returns generic success for unknown email in forgot-password", async () => {
    findOneMock.mockResolvedValue(null);

    const request = {
      body: { email: "nobody@example.com" },
    } as Request;
    const response = createMockResponse();

    await forgotPassword(request as Request<unknown, unknown, { email: string }>, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      message: "If an account exists, reset instructions were sent.",
    });
    expect(redisSetMock).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("stores reset secret and emails user for existing account", async () => {
    findOneMock.mockResolvedValue({
      _id: { toString: () => "user-1" },
      email: "creator@example.com",
      isDeleted: false,
    });
    redisSetMock.mockResolvedValue("OK");
    sendPasswordResetEmailMock.mockResolvedValue(undefined);

    const request = {
      body: { email: "creator@example.com" },
    } as Request;
    const response = createMockResponse();

    await forgotPassword(request as Request<unknown, unknown, { email: string }>, response);

    expect(redisSetMock).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("rejects reset-password when secret is invalid", async () => {
    redisGetMock.mockResolvedValue(null);

    const request = {
      query: { secret: "missing-secret" },
      body: { password: "NewPassword123", confirmPassword: "NewPassword123" },
    } as unknown as Request;
    const response = createMockResponse();

    await expect(
      resetPassword(
        request as Request<
          unknown,
          unknown,
          { password: string; confirmPassword: string },
          { secret: string }
        >,
        response,
      ),
    ).rejects.toMatchObject({
      message: "Reset secret is invalid or expired",
      statusCode: 401,
    });
  });

  it("updates password and invalidates secret for valid reset request", async () => {
    redisGetMock.mockResolvedValue(JSON.stringify({ userId: "507f1f77bcf86cd799439011" }));
    hashMock.mockResolvedValue("hashed-password");
    const saveMock = vi.fn().mockResolvedValue(undefined);
    findByIdMock.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: { toString: () => "user-1" },
        isDeleted: false,
        authType: "email",
        authMethods: ["email"],
        password: "old-password-hash",
        save: saveMock,
      }),
    });
    redisDelMock.mockResolvedValue(1);

    const request = {
      query: { secret: "valid-secret" },
      body: { password: "NewPassword123", confirmPassword: "NewPassword123" },
    } as unknown as Request;
    const response = createMockResponse();

    await resetPassword(
      request as Request<
        unknown,
        unknown,
        { password: string; confirmPassword: string },
        { secret: string }
      >,
      response,
    );

    expect(hashMock).toHaveBeenCalledWith("NewPassword123", 10);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(redisDelMock).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      message: "Password reset successful.",
    });
  });
});
