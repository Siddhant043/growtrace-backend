import { customAlphabet } from "nanoid";

const shortCodeAlphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const generateAlphaNumericCode = customAlphabet(shortCodeAlphabet, 7);

export const generateShortCode = (): string => generateAlphaNumericCode();
