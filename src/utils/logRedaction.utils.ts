const SENSITIVE_KEY_TOKENS = [
  "password",
  "token",
  "authorization",
  "cookie",
  "secret",
  "apiKey",
  "apikey",
  "jwt",
] as const;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const shouldRedactKey = (key: string): boolean => {
  const normalizedKey = key.toLowerCase();
  return SENSITIVE_KEY_TOKENS.some((token) => normalizedKey.includes(token));
};

export const redactSensitiveValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveValue(entry));
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const redactedEntries = Object.entries(value).map(([entryKey, entryValue]) => {
    if (shouldRedactKey(entryKey)) {
      return [entryKey, "[REDACTED]"] as const;
    }
    return [entryKey, redactSensitiveValue(entryValue)] as const;
  });

  return Object.fromEntries(redactedEntries);
};
