export const getCountryFromIP = async (_ipAddress: string | undefined): Promise<string> => {
  // Phase 1 fallback. Replace with real GeoIP provider in later phases.
  return "IN";
};
