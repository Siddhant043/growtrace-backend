import { formatDateAsUtcIsoDate } from "./dateBounds.utils.js";

const MILLIS_PER_DAY = 86_400_000;

const cloneDateAtUtcMidnight = (sourceDate: Date): Date => {
  const cloneDate = new Date(
    Date.UTC(
      sourceDate.getUTCFullYear(),
      sourceDate.getUTCMonth(),
      sourceDate.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  return cloneDate;
};

export const getMostRecentSundayAtUtcMidnight = (
  referenceDate: Date = new Date(),
): Date => {
  const utcMidnight = cloneDateAtUtcMidnight(referenceDate);
  const utcDayOfWeek = utcMidnight.getUTCDay();

  if (utcDayOfWeek === 0) {
    utcMidnight.setUTCDate(utcMidnight.getUTCDate() - 7);
    return utcMidnight;
  }

  utcMidnight.setUTCDate(utcMidnight.getUTCDate() - utcDayOfWeek);
  return utcMidnight;
};

export type WeeklyReportDateWindow = {
  weekStart: Date;
  weekEnd: Date;
  weekStartIsoDate: string;
  weekEndIsoDate: string;
};

const buildWeekWindowFromMonday = (
  mondayAtUtcMidnight: Date,
): WeeklyReportDateWindow => {
  const weekStart = cloneDateAtUtcMidnight(mondayAtUtcMidnight);
  const weekEnd = new Date(weekStart.getTime() + 6 * MILLIS_PER_DAY);
  return {
    weekStart,
    weekEnd,
    weekStartIsoDate: formatDateAsUtcIsoDate(weekStart),
    weekEndIsoDate: formatDateAsUtcIsoDate(weekEnd),
  };
};

export const computePreviousIsoWeekWindow = (
  referenceDate: Date = new Date(),
): WeeklyReportDateWindow => {
  const previousSunday = getMostRecentSundayAtUtcMidnight(referenceDate);
  const previousMonday = new Date(previousSunday.getTime() - 6 * MILLIS_PER_DAY);
  return buildWeekWindowFromMonday(previousMonday);
};

export const computeWeekWindowEndingOnDate = (
  endIsoDate: string,
): WeeklyReportDateWindow => {
  const weekEnd = new Date(`${endIsoDate}T00:00:00.000Z`);
  const weekStart = new Date(weekEnd.getTime() - 6 * MILLIS_PER_DAY);
  return buildWeekWindowFromMonday(weekStart);
};

export const computeWeekWindowBefore = (
  window: WeeklyReportDateWindow,
): WeeklyReportDateWindow => {
  const previousMonday = new Date(window.weekStart.getTime() - 7 * MILLIS_PER_DAY);
  return buildWeekWindowFromMonday(previousMonday);
};
