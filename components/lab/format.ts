import { DAY_MS } from "@/lib/dates";

/** Shown in place of CAGR and Calmar when a run is too short to annualize. */
export const SHORT_RUN = "n/a (under 1 year)";

/** Calendar days from the first date to the last (YYYY-MM-DD). */
const runDays = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS);

/** A run under 365 calendar days: CAGR would be an extrapolation, so it is not shown. */
export const isShortRun = (start: string, end: string) => runDays(start, end) < 365;

interface GrowthCurve {
  dates: string[];
  /** Growth of 1 at each date, from the run's own start. */
  growth: ArrayLike<number>;
}

/**
 * Rebase growth curves to 1 at the latest start date they all share, so runs
 * that began on different days are drawn from the same origin. A curve with no
 * point on or after that date comes back null. Dates are the union of the
 * remaining curves' dates; a curve with no bar on a date gets NaN there.
 */
export function rebaseToCommonStart(curves: GrowthCurve[]): { start: string | null; dates: string[]; values: (number[] | null)[] } {
  const starts = curves.filter((c) => c.dates.length > 0).map((c) => c.dates[0]);
  if (starts.length === 0) return { start: null, dates: [], values: [] };
  const start = starts.reduce((a, b) => (b > a ? b : a));

  const rebased = curves.map((c) => {
    const i = c.dates.findIndex((d) => d >= start);
    const base = i === -1 ? NaN : c.growth[i];
    if (!(base > 0)) return null;
    const byDate = new Map<string, number>();
    for (let t = i; t < c.dates.length; t++) byDate.set(c.dates[t], c.growth[t] / base);
    return byDate;
  });

  const dates = [...new Set(rebased.flatMap((m) => (m ? [...m.keys()] : [])))].sort();
  const values = rebased.map((m) => (m ? dates.map((d) => m.get(d) ?? NaN) : null));
  return { start, dates, values };
}
