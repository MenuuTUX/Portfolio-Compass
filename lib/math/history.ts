import { PortfolioItem } from "@/types";

/**
 * What a history-derived return means. "total" uses dividend-adjusted closes,
 * so distributions are reinvested. "price" uses split-adjusted closes and
 * leaves distributions out; it is the labelled fallback when any holding has
 * no usable adjusted close.
 */
export type ReturnBasis = "total" | "price";

export interface AlignedPriceHistory {
  dates: string[];
  /**
   * One series per holding. On the "total" basis each is the first aligned
   * close grown by the adjusted-close ratio, so share-weighted values start at
   * the true market value and then include reinvested distributions.
   */
  prices: number[][];
  basis: ReturnBasis;
}

/** Share of a holding's priced dates that must carry an adjusted close. */
const MIN_ADJUSTED_COVERAGE = 0.95;

type HistoryLike = { price: number; adjPrice?: number };

export function validAdjusted(point: HistoryLike): number | null {
  const adj = Number(point.adjPrice);
  return point.adjPrice != null && Number.isFinite(adj) && adj > 0 ? adj : null;
}

/**
 * "total" only when every holding has an adjusted close on nearly all of its
 * priced dates. One holding without them puts the whole computation on "price":
 * mixing bases across holdings would be wrong, and a missing value must not
 * turn into a zero or a silent price fallback.
 */
export function selectReturnBasis(
  histories: ReadonlyArray<ReadonlyArray<HistoryLike>>,
): ReturnBasis {
  if (histories.length === 0) return "price";
  const covered = histories.every((points) => {
    const priced = points.filter((p) => Number.isFinite(Number(p.price)) && Number(p.price) > 0);
    if (priced.length === 0) return false;
    return priced.filter((p) => validAdjusted(p) !== null).length / priced.length >= MIN_ADJUSTED_COVERAGE;
  });
  return covered ? "total" : "price";
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
 *
 * On the "total" basis a date where any holding lacks an adjusted close is
 * dropped for everyone, like any other missing price.
 */
export function alignPriceHistories(
  items: PortfolioItem[],
): AlignedPriceHistory | null {
  if (items.length === 0) return null;

  const basis = selectReturnBasis(items.map((item) => item.history ?? []));

  const series = items.map((item) => {
    const byDate = new Map<string, { price: number; adj: number | null }>();

    for (const point of item.history ?? []) {
      const timestamp = new Date(point.date).getTime();
      const price = Number(point.price);
      if (!Number.isFinite(timestamp) || !Number.isFinite(price) || price <= 0) {
        continue;
      }

      // The market endpoints return UTC timestamps, while some fixtures use a
      // date-only string. Normalizing to a UTC day handles both shapes.
      const date = new Date(timestamp).toISOString().slice(0, 10);
      byDate.set(date, { price, adj: validAdjusted(point) });
    }

    return byDate;
  });

  const dates = [...series[0].keys()]
    .filter((date) => series.every((prices) => {
      const point = prices.get(date);
      return point !== undefined && (basis === "price" || point.adj !== null);
    }))
    .sort();

  if (dates.length < 2) return null;

  return {
    dates,
    basis,
    prices: series.map((prices) => {
      if (basis === "price") return dates.map((date) => prices.get(date)!.price);
      const first = prices.get(dates[0])!;
      return dates.map((date) => first.price * (prices.get(date)!.adj! / first.adj!));
    }),
  };
}
