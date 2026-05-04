const BOT_USER_AGENT_PATTERN =
  /bot|crawler|spider|slurp|facebookexternalhit|preview|headlesschrome|phantomjs|googlebot|bingbot|yandex|duckduckbot|baiduspider|semrush|ahrefs|mj12bot|petalbot|applebot|chatgpt-user|gptbot/i;

export const isLikelyBot = (userAgentHeaderValue: string | undefined): boolean => {
  const normalizedUserAgent = userAgentHeaderValue?.trim() ?? "";
  if (normalizedUserAgent.length === 0) {
    return true;
  }

  return BOT_USER_AGENT_PATTERN.test(normalizedUserAgent);
};
