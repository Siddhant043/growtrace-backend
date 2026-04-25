import { Types } from "mongoose";

export const SUPPORTED_TREND_RANGES = ["7d", "30d"] as const;
export type TrendRange = (typeof SUPPORTED_TREND_RANGES)[number];

export const toObjectId = (id: string): Types.ObjectId => new Types.ObjectId(id);

export const calculatePercentage = (numerator: number, denominator: number): number => {
  if (denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
};

export const getRangeStartDate = (
  range: TrendRange,
  referenceDate: Date = new Date(),
): Date => {
  const rangeInDays = range === "30d" ? 30 : 7;
  const startDate = new Date(referenceDate);
  startDate.setDate(startDate.getDate() - (rangeInDays - 1));
  startDate.setHours(0, 0, 0, 0);
  return startDate;
};

export const isSupportedTrendRange = (range: string): range is TrendRange =>
  SUPPORTED_TREND_RANGES.includes(range as TrendRange);
