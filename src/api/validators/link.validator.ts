import { z } from "zod";

import { LINK_PLATFORMS } from "../models/link.model";

const linkPlatformSchema = z.enum(LINK_PLATFORMS);

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

export type CreateLinkRequestBody = z.infer<typeof createLinkRequestSchema>["body"];
