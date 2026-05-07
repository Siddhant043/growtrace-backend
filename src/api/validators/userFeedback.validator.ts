import { z } from "zod";

import { FEEDBACK_CATEGORIES } from "../models/feedback.model.js";

export const submitMyFeedbackRequestSchema = z.object({
  body: z.object({
    message: z.string().trim().min(10).max(3000),
    category: z.enum(FEEDBACK_CATEGORIES).optional(),
  }),
});

export type SubmitMyFeedbackRequestBody = z.infer<
  typeof submitMyFeedbackRequestSchema
>["body"];
