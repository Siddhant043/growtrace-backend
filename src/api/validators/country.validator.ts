import { z } from "zod";

import {
  isSupportedCountryCode,
  normalizeCountryCode,
} from "../../constants/countries.js";

export const countryCodeSchema = z
  .string()
  .trim()
  .min(2, "Country code is required")
  .max(2, "Country code must be 2 characters")
  .transform((value) => normalizeCountryCode(value))
  .refine((value) => isSupportedCountryCode(value), {
    message: "Country code is not supported",
  });
