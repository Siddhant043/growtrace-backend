export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const isValidIsoDate = (value: string | undefined): value is string =>
  typeof value === "string" && ISO_DATE_REGEX.test(value);

export const computeDayBoundsUtc = (
  isoDate: string,
): { dayStart: Date; dayEnd: Date } => {
  if (!isValidIsoDate(isoDate)) {
    throw new Error(
      `dateBounds.utils: invalid date format "${isoDate}", expected YYYY-MM-DD`,
    );
  }

  const dayStart = new Date(`${isoDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${isoDate}T00:00:00.000Z`);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  return { dayStart, dayEnd };
};

export const formatDateAsUtcIsoDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getCurrentUtcDateString = (): string =>
  formatDateAsUtcIsoDate(new Date());

export const getPreviousUtcDateString = (): string => {
  const previousUtcDate = new Date();
  previousUtcDate.setUTCDate(previousUtcDate.getUTCDate() - 1);
  return formatDateAsUtcIsoDate(previousUtcDate);
};
