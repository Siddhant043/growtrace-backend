import { z } from "zod";

/** Route param may be a Mongo ObjectId or a link shortCode (see link routes). */
export const linkIdOrShortCodeParamSchema = z
  .string()
  .trim()
  .min(1, "linkId is required")
  .max(128);
