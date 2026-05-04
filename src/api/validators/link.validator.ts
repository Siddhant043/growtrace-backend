import { z } from "zod";

import { LINK_PLATFORMS } from "../models/link.model.js";

const linkPlatformSchema = z.enum(LINK_PLATFORMS);
const sortBySchema = z.enum(["createdAt", "shortCode", "platform"]);
const sortOrderSchema = z.enum(["asc", "desc"]);

export const createLinkRequestSchema = z.object({
  body: z.object({
    originalUrl: z
      .string()
      .trim()
      .url("originalUrl must be a valid URL"),
    platform: linkPlatformSchema,
    postId: z.string().trim().max(120).optional(),
    campaign: z.string().trim().max(120).optional(),
  }),
});

const shortCodeParamsSchema = z.object({
  shortCode: z.string().trim().min(1, "shortCode is required"),
});

export const linkByShortCodeRequestSchema = z.object({
  params: shortCodeParamsSchema,
});

export const updateLinkRequestSchema = z.object({
  params: shortCodeParamsSchema,
  body: z
    .object({
      originalUrl: z
        .string()
        .trim()
        .url("originalUrl must be a valid URL")
        .optional(),
      platform: linkPlatformSchema.optional(),
      postId: z.string().trim().max(120).optional(),
      campaign: z.string().trim().max(120).optional(),
    })
    .refine(
      (body) =>
        body.originalUrl !== undefined ||
        body.platform !== undefined ||
        body.postId !== undefined ||
        body.campaign !== undefined,
      {
        message: "At least one field must be provided",
      },
    ),
});

export const deleteLinkRequestSchema = z.object({
  params: shortCodeParamsSchema,
});

const listLinksQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  platform: linkPlatformSchema.optional(),
  sortBy: sortBySchema.default("createdAt"),
  sortOrder: sortOrderSchema.default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const listLinksRequestSchema = z.object({
  query: listLinksQuerySchema,
});

export type CreateLinkRequestBody = z.infer<typeof createLinkRequestSchema>["body"];
export type LinkByShortCodeParams = z.infer<
  typeof linkByShortCodeRequestSchema
>["params"];
export type UpdateLinkRequestBody = z.infer<typeof updateLinkRequestSchema>["body"];
export type ListLinksRequestQuery = z.infer<typeof listLinksRequestSchema>["query"];
