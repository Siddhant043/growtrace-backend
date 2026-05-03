import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { env } from "../../src/config/env.js";

const {
  findOneMock,
  findByIdMock,
  hashMock,
  sendPasswordResetEmailMock,
  sendPasswordUpdatedEmailMock,
  connectToRedisMock,
  redisGetMock,
  redisSetMock,
  redisDelMock,
} = vi.hoisted(() => ({
  findOneMock: vi.fn(),
  findByIdMock: vi.fn(),
  hashMock: vi.fn(),
  sendPasswordResetEmailMock: vi.fn(),
  sendPasswordUpdatedEmailMock: vi.fn(),
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
  sendPasswordUpdatedEmail: sendPasswordUpdatedEmailMock,
}));

vi.mock("../../src/infrastructure/redis", () => ({
  connectToRedis: connectToRedisMock,
}));

import {
  forgotPassword,
  resetPassword,
} from "../../src/api/controllers/auth.controller.js";

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
    sendPasswordUpdatedEmailMock.mockReset();
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
    const sentEmailObject = sendPasswordResetEmailMock.mock.calls[0]?.[0] as {
      from: string;
      to: string;
      subject: string;
      text: string;
      html: string;
    };
    expect(sentEmailObject.from).toBe(env.SMTP_FROM);
    expect(sentEmailObject.to).toBe("creator@example.com");
    expect(sentEmailObject.subject).toBe("GrowTrace password reset");
    expect(sentEmailObject.text).toContain(`${env.CLIENT_APP_URL}/reset-password?secret=`);
    expect(sentEmailObject.text).toContain("This link is valid for 10 minutes");
    expect(sentEmailObject.html).toContain("Reset your GrowTrace password");
    expect(sentEmailObject.html).toContain("This link expires in 10 minutes");
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("still returns success when email sending fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    findOneMock.mockResolvedValue({
      _id: { toString: () => "user-1" },
      email: "creator@example.com",
      isDeleted: false,
    });
    redisSetMock.mockResolvedValue("OK");
    sendPasswordResetEmailMock.mockRejectedValue(new Error("smtp failure"));

    const request = {
      body: { email: "creator@example.com" },
    } as Request;
    const response = createMockResponse();

    await forgotPassword(request as Request<unknown, unknown, { email: string }>, response);

    expect(redisSetMock).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      message: "If an account exists, reset instructions were sent.",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to send password reset email",
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
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
        email: "reset-user@example.com",
        isDeleted: false,
        authType: "email",
        authMethods: ["email"],
        password: "old-password-hash",
        save: saveMock,
      }),
    });
    redisDelMock.mockResolvedValue(1);
    sendPasswordUpdatedEmailMock.mockResolvedValue(undefined);

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
    expect(sendPasswordUpdatedEmailMock).toHaveBeenCalledTimes(1);
    const sentEmailObject = sendPasswordUpdatedEmailMock.mock.calls[0]?.[0] as {
      from: string;
      to: string;
      subject: string;
      text: string;
      html: string;
    };
    expect(sentEmailObject.from).toBe(env.SMTP_FROM);
    expect(sentEmailObject.to).toBe("reset-user@example.com");
    expect(sentEmailObject.subject).toBe("GrowTrace password updated");
    expect(sentEmailObject.text).toContain("password has been updated successfully");
    expect(sentEmailObject.html).toContain("Your password was updated");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      message: "Password reset successful.",
    });
  });

  it("still returns success when password-updated email sending fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    redisGetMock.mockResolvedValue(JSON.stringify({ userId: "507f1f77bcf86cd799439011" }));
    hashMock.mockResolvedValue("hashed-password");
    const saveMock = vi.fn().mockResolvedValue(undefined);
    findByIdMock.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: { toString: () => "user-1" },
        email: "reset-user@example.com",
        isDeleted: false,
        authType: "email",
        authMethods: ["email"],
        password: "old-password-hash",
        save: saveMock,
      }),
    });
    redisDelMock.mockResolvedValue(1);
    sendPasswordUpdatedEmailMock.mockRejectedValue(new Error("smtp failure"));

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

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(redisDelMock).toHaveBeenCalledTimes(1);
    expect(sendPasswordUpdatedEmailMock).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      message: "Password reset successful.",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to send password updated email",
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });
});
