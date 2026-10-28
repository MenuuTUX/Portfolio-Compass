import type { PortfolioItem } from "@/types";

export interface IndexPoint {
  t: string;
  v: number;
}

/**
 * Buy-and-hold index (starts at 100) of the current target weights applied to
 * each holding's past prices. Uses only dates every holding has a price for,
 * and returns [] when any holding has no usable history or weights sum to 0.
 */
export function buildPortfolioIndex(portfolio: PortfolioItem[]): IndexPoint[] {
  const held = portfolio.filter((item) => item.weight > 0);
  const totalWeight = held.reduce((sum, item) => sum + item.weight, 0);
  if (held.length === 0 || totalWeight <= 0) return [];

  const series = held.map((item) => {
    const byDate = new Map<string, number>();
    for (const point of item.history ?? []) {
      if (Number.isFinite(point.price) && point.price > 0) byDate.set(point.date, point.price);
    }
    return byDate;
  });
  if (series.some((byDate) => byDate.size < 2)) return [];

  const dates = [...series[0].keys()].filter((date) => series.every((byDate) => byDate.has(date))).sort();
  if (dates.length < 2) return [];

  const first = series.map((byDate) => byDate.get(dates[0])!);
  return dates.map((date) => ({
    t: date,
    v: 100 * held.reduce((sum, item, i) => sum + (item.weight / totalWeight) * (series[i].get(date)! / first[i]), 0),
  }));
}

export type IndexRange = "1M" | "3M" | "6M" | "1Y" | "ALL";

const RANGE_DAYS: Record<Exclude<IndexRange, "ALL">, number> = { "1M": 30, "3M": 91, "6M": 182, "1Y": 365 };

/** Ranges the series actually covers, plus ALL. */
export function availableRanges(points: IndexPoint[]): IndexRange[] {
  if (points.length < 2) return [];
  const spanDays = (Date.parse(points[points.length - 1].t) - Date.parse(points[0].t)) / 86_400_000;
  const ranges = (Object.keys(RANGE_DAYS) as Exclude<IndexRange, "ALL">[]).filter((r) => spanDays >= RANGE_DAYS[r] * 0.9);
  return [...ranges, "ALL"];
}

/** Trailing slice of the series, re-based to 100 at its first point. */
export function sliceIndex(points: IndexPoint[], range: IndexRange): IndexPoint[] {
  if (range === "ALL" || points.length < 2) return points;
  const cutoff = Date.parse(points[points.length - 1].t) - RANGE_DAYS[range] * 86_400_000;
  const slice = points.filter((p) => Date.parse(p.t) >= cutoff);
  if (slice.length < 2) return points;
  const base = slice[0].v;
  return slice.map((p) => ({ t: p.t, v: (100 * p.v) / base }));
}
