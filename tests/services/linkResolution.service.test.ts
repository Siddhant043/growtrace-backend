import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const { findOneMock } = vi.hoisted(() => ({
  findOneMock: vi.fn(),
}));

vi.mock("../../src/api/models/link.model.js", () => ({
  LinkModel: {
    findOne: findOneMock,
  },
}));

import { resolveOwnedLinkMongoId } from "../../src/services/linkResolution.service.js";

const userId = new Types.ObjectId().toHexString();
const linkObjectId = new Types.ObjectId();

const mockFindOneLean = (document: { _id: Types.ObjectId } | null) => {
  findOneMock.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(document),
    }),
  });
};

describe("resolveOwnedLinkMongoId", () => {
  beforeEach(() => {
    findOneMock.mockReset();
  });

  it("resolves a 24-character hex ObjectId owned by the user", async () => {
    mockFindOneLean({ _id: linkObjectId });

    const resolvedId = await resolveOwnedLinkMongoId(
      userId,
      linkObjectId.toHexString(),
    );

    expect(resolvedId).toBe(linkObjectId.toHexString());
    expect(findOneMock).toHaveBeenCalledWith({
      _id: linkObjectId,
      userId: new Types.ObjectId(userId),
    });
  });

  it("resolves a shortCode owned by the user", async () => {
    mockFindOneLean({ _id: linkObjectId });

    const resolvedId = await resolveOwnedLinkMongoId(userId, "rWkIWie");

    expect(resolvedId).toBe(linkObjectId.toHexString());
    expect(findOneMock).toHaveBeenCalledWith({
      shortCode: "rWkIWie",
      userId: new Types.ObjectId(userId),
    });
  });

  it("throws 404 when the link is not found", async () => {
    mockFindOneLean(null);

    await expect(resolveOwnedLinkMongoId(userId, "missing")).rejects.toMatchObject({
      message: "Link not found",
      statusCode: 404,
    });
  });
});
