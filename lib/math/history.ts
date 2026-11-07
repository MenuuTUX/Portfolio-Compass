import { Portfolio, PortfolioItem } from "@/types";
import { DAY_MS, YEAR_DAYS, isoDay } from "@/lib/dates";

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
  return histories.every(hasAdjustedCoverage) ? "total" : "price";
}

/** True when a holding has adjusted closes on at least 95% of its priced dates. */
function hasAdjustedCoverage(points: ReadonlyArray<HistoryLike>): boolean {
  const priced = points.filter((p) => Number.isFinite(Number(p.price)) && Number(p.price) > 0);
  if (priced.length === 0) return false;
  return priced.filter((p) => validAdjusted(p) !== null).length / priced.length >= MIN_ADJUSTED_COVERAGE;
}

/** Tickers of held holdings whose history does not meet the adjusted-close rule used by selectReturnBasis. */
export function tickersWithoutAdjustedHistory(portfolio: Portfolio): string[] {
  return portfolio
    .filter((item) => item.shares > 0 && !hasAdjustedCoverage(item.history ?? []))
    .map((item) => item.ticker);
}

/**
 * Average number of observations per calendar year, from the first and last
 * dates. Not snapped to 252, so weekly or monthly data annualizes correctly.
 */
export function observationsPerYear(dates: string[]): number {
  if (dates.length < 3) return 252;
  const first = Date.parse(dates[0]);
  const last = Date.parse(dates[dates.length - 1]);
  const years = (last - first) / DAY_MS / YEAR_DAYS;
  if (!(years > 0) || !Number.isFinite(years)) return 252;
  return (dates.length - 1) / years;
}

export type HistoryDiagnosis =
  | { ok: true }
  | { ok: false; reason: "too-short" | "gap"; ticker: string; found: number; needed: number; gapDays?: number };

/** Distinct UTC days on which a holding has a usable price, ascending. */
function usableDates(points: ReadonlyArray<{ date: string; price: number }>): string[] {
  const dates = new Set<string>();
  for (const point of points) {
    const timestamp = new Date(point.date).getTime();
    const price = Number(point.price);
    if (!Number.isFinite(timestamp) || !Number.isFinite(price) || price <= 0) continue;
    dates.add(isoDay(timestamp));
  }
  return [...dates].sort();
}

/**
 * Checks each held holding's own history. Holdings are checked shortest first,
 * and the first failure is returned: too short for `minReturns` daily returns,
 * or a gap of more than a week between consecutive observations.
 */
export function diagnoseHistory(portfolio: Portfolio, minReturns = 200): HistoryDiagnosis {
  const held = portfolio
    .filter((item) => item.shares > 0)
    .map((item) => ({ ticker: item.ticker, dates: usableDates(item.history ?? []) }))
    .sort((a, b) => a.dates.length - b.dates.length);

  for (const { ticker, dates } of held) {
    const found = Math.max(0, dates.length - 1);
    if (found < minReturns) {
      return { ok: false, reason: "too-short", ticker, found, needed: minReturns };
    }
    for (let i = 1; i < dates.length; i++) {
      const gapDays = Math.round((Date.parse(dates[i]) - Date.parse(dates[i - 1])) / DAY_MS);
      if (gapDays > 7) {
        return { ok: false, reason: "gap", ticker, found, needed: minReturns, gapDays };
      }
    }
  }
  return { ok: true };
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
    const gapDays = (current - previous) / DAY_MS;
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
      const date = isoDay(timestamp);
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
