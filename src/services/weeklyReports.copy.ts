export type WeeklyReportCopyContext = {
  firstName: string;
  topPlatformName: string | null;
  topShortCode: string | null;
  deltaPct: number;
  totalClicks: number;
  isFirstReport: boolean;
  isMinimal: boolean;
};

export type WeeklyReportCopyOutput = {
  headline: string;
  emailSubject: string;
  ctaLabel: string;
};

const FIRST_NAME_FALLBACK = "there";

export const extractFirstName = (fullName: string | null | undefined): string => {
  if (typeof fullName !== "string") {
    return FIRST_NAME_FALLBACK;
  }

  const trimmed = fullName.trim();
  if (trimmed.length === 0) {
    return FIRST_NAME_FALLBACK;
  }

  const [firstWord] = trimmed.split(/\s+/);
  return firstWord ?? FIRST_NAME_FALLBACK;
};

const formatPlatformLabel = (platformName: string): string => {
  if (platformName.length === 0) {
    return platformName;
  }
  return platformName.charAt(0).toUpperCase() + platformName.slice(1);
};

const formatSignedPercent = (deltaPct: number): string => {
  const roundedAbs = Math.round(Math.abs(deltaPct));
  if (deltaPct >= 0) {
    return `+${roundedAbs}%`;
  }
  return `-${roundedAbs}%`;
};

const buildCtaLabel = (deltaPct: number, isMinimal: boolean): string => {
  if (isMinimal) {
    return "Open this week's report";
  }
  if (deltaPct > 0) {
    return "See what worked";
  }
  if (deltaPct < 0) {
    return "See what to fix";
  }
  return "View full breakdown";
};

const buildHeadline = (context: WeeklyReportCopyContext): string => {
  if (context.isFirstReport) {
    return `Welcome${context.firstName === FIRST_NAME_FALLBACK ? "" : `, ${context.firstName}`} — your first weekly report is in.`;
  }

  if (context.isMinimal) {
    return "Your week was quiet — let's plan your comeback.";
  }

  if (Math.abs(context.deltaPct) >= 25) {
    return context.deltaPct >= 0
      ? `You're up ${formatSignedPercent(context.deltaPct)} on engagement.`
      : `Your engagement dipped ${formatSignedPercent(context.deltaPct)}. Here's how to recover.`;
  }

  if (context.topPlatformName) {
    return `${formatPlatformLabel(context.topPlatformName)} carried your week.`;
  }

  if (context.topShortCode) {
    return `Your link "${context.topShortCode}" did the heavy lifting.`;
  }

  if (context.deltaPct > 0) {
    return `You're up ${formatSignedPercent(context.deltaPct)} on engagement.`;
  }
  if (context.deltaPct < 0) {
    return `Engagement softened by ${formatSignedPercent(context.deltaPct)} this week.`;
  }

  return "Your weekly snapshot is ready.";
};

const buildEmailSubject = (context: WeeklyReportCopyContext): string => {
  if (context.isFirstReport) {
    return "Welcome — your first GrowTrace report is here";
  }

  if (Math.abs(context.deltaPct) >= 25) {
    return `Your week: ${formatSignedPercent(context.deltaPct)} engagement`;
  }

  if (context.topPlatformName) {
    return `${formatPlatformLabel(context.topPlatformName)} carried you this week`;
  }

  if (context.isMinimal) {
    return "Quiet week — let's change that";
  }

  if (context.topShortCode) {
    return `One link did the work this week (${context.topShortCode})`;
  }

  return "Your weekly GrowTrace report";
};

export const buildWeeklyReportCopy = (
  context: WeeklyReportCopyContext,
): WeeklyReportCopyOutput => {
  return {
    headline: buildHeadline(context),
    emailSubject: buildEmailSubject(context),
    ctaLabel: buildCtaLabel(context.deltaPct, context.isMinimal),
  };
};
