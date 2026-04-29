import {
  formatDateAsUtcIsoDate,
  isValidIsoDate,
} from "./dateBounds.utils";

const DEFAULT_RANGE_DAYS = 30;

export type DateRangeInput = {
  fromDate?: string;
  toDate?: string;
};

export type ResolvedDateRange = {
  fromDate: string;
  toDate: string;
};

export const resolveDateRange = (
  rangeInput: DateRangeInput,
  defaultRangeDays: number = DEFAULT_RANGE_DAYS,
): ResolvedDateRange => {
  const today = new Date();
  const defaultToDate = formatDateAsUtcIsoDate(today);

  const defaultFromBoundary = new Date(today);
  defaultFromBoundary.setUTCDate(
    defaultFromBoundary.getUTCDate() - (defaultRangeDays - 1),
  );
  const defaultFromDate = formatDateAsUtcIsoDate(defaultFromBoundary);

  const resolvedFromDate = isValidIsoDate(rangeInput.fromDate)
    ? rangeInput.fromDate
    : defaultFromDate;
  const resolvedToDate = isValidIsoDate(rangeInput.toDate)
    ? rangeInput.toDate
    : defaultToDate;

  if (resolvedFromDate > resolvedToDate) {
    return { fromDate: resolvedToDate, toDate: resolvedFromDate };
  }

  return { fromDate: resolvedFromDate, toDate: resolvedToDate };
};
