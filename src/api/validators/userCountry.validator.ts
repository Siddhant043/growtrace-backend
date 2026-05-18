import { z } from "zod";

import { countryCodeSchema } from "./country.validator.js";

export const updateUserCountryRequestSchema = z.object({
  body: z.object({
    countryCode: countryCodeSchema,
  }),
});

export type UpdateUserCountryRequestBody = z.infer<
  typeof updateUserCountryRequestSchema
>["body"];
