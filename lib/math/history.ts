import { PortfolioItem } from "@/types";

export interface AlignedPriceHistory {
  dates: string[];
  prices: number[][];
}

/** Reject a series with invalid, unordered, or unusually large gaps in its lookback. */
export function hasDailyObservationCoverage(
  dates: string[],
  maxGapDays = 7,
): boolean {
  if (dates.length < 2) return false;
  for (let i = 1; i < dates.length; i++) {
    const previous = new Date(dates[i - 1]).getTime();
    const current = new Date(dates[i]).getTime();
    const gapDays = (current - previous) / 86_400_000;
    if (!Number.isFinite(previous) || !Number.isFinite(current) || gapDays <= 0 || gapDays > maxGapDays) {
      return false;
    }
  }
  return true;
}

/**
 * Align usable price observations by calendar date.
 *
 * Market series can have different start dates and occasional missing points.
 * Slicing each array to the same length is not enough because equal indexes do
 * not necessarily represent the same trading session.
 */
export function alignPriceHistories(
  items: PortfolioItem[],
): AlignedPriceHistory | null {
  if (items.length === 0) return null;

  const series = items.map((item) => {
    const byDate = new Map<string, number>();

    for (const point of item.history ?? []) {
      const timestamp = new Date(point.date).getTime();
      const price = Number(point.price);
      if (!Number.isFinite(timestamp) || !Number.isFinite(price) || price <= 0) {
        continue;
      }

      // The market endpoints return UTC timestamps, while some fixtures use a
      // date-only string. Normalizing to a UTC day handles both shapes.
      const date = new Date(timestamp).toISOString().slice(0, 10);
      byDate.set(date, price);
    }

    return byDate;
  });

  const dates = [...series[0].keys()]
    .filter((date) => series.every((prices) => prices.has(date)))
    .sort();

  if (dates.length < 2) return null;

  return {
    dates,
    prices: series.map((prices) => dates.map((date) => prices.get(date)!)),
  };
}
