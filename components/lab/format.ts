// Number formatting for Compass Lab. A missing value reads as "n/a", never 0.
// Float dust from cash accounting (like -0.000001) displays as zero.

const clean = (v: number, eps: number) => (Math.abs(v) < eps ? 0 : v);

export const pct = (v: number | null | undefined, digits = 1) =>
  v == null || !Number.isFinite(v) ? "n/a" : `${clean(v * 100, 0.5 * 10 ** -digits).toFixed(digits)}%`;

export const signedPct = (v: number | null | undefined, digits = 1) =>
  v == null || !Number.isFinite(v) ? "n/a" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(digits)}%`;

export const ratio = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "n/a" : v.toFixed(2);

export function money(v: number | null | undefined, currency = "USD") {
  if (v == null || !Number.isFinite(v)) return "n/a";
  v = clean(v, 0.005);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2,
  }).format(v);
}

export function compactMoney(v: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(v);
}

const DAY_MS = 86_400_000;

/** Shown in place of CAGR and Calmar when a run is too short to annualize. */
export const SHORT_RUN = "n/a (under 1 year)";

/** Calendar days from the first date to the last (YYYY-MM-DD). */
export const runDays = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS);

/** A run under 365 calendar days: CAGR would be an extrapolation, so it is not shown. */
export const isShortRun = (start: string, end: string) => runDays(start, end) < 365;

export interface GrowthCurve {
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
