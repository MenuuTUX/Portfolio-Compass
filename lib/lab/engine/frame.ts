import type { BarSeries } from "@/lib/lab/bar-types";

// Aligned price arrays for the Compass Lab engine. Arrays are row-major,
// index `t * tickers.length + j`. A ticker with no bar on a date holds NaN
// there: before its first bar it is not tradable, and after a gap the engine
// values it at its last close. A missing price never becomes zero.

export interface Frame {
  dates: string[];
  tickers: string[];
  currency: string;
  /** Split-adjusted open, close and adjClose, in `currency`. */
  open: Float64Array;
  close: Float64Array;
  adjClose: Float64Array;
  /** Cash dividend per share on its ex-date, in `currency`; 0 elsewhere. */
  dividend: Float64Array;
}

/** Rates as units of the base currency per one unit of `currency`, by date. */
export type FxSeries = Record<string, { date: string; rate: number }[]>;

function rateLookup(points: { date: string; rate: number }[], currency: string) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  let i = 0;
  return (date: string): number => {
    // Dates are visited in ascending order, so the cursor only moves forward.
    while (i + 1 < sorted.length && sorted[i + 1].date <= date) i++;
    const point = sorted[i];
    if (!point || point.date > date || !(point.rate > 0)) {
      throw new Error(`No ${currency} FX rate on or before ${date}`);
    }
    return point.rate;
  };
}

export function buildFrame(
  series: BarSeries[],
  { baseCurrency, fx = {} }: { baseCurrency: string; fx?: FxSeries },
): Frame {
  if (series.length === 0) throw new Error("No price series to backtest");
  const tickers = series.map((s) => s.ticker);
  if (new Set(tickers).size !== tickers.length) throw new Error("Duplicate tickers in universe");

  const dates = [...new Set(series.flatMap((s) => s.bars.map((b) => b.date)))].sort();
  const row = new Map(dates.map((d, t) => [d, t]));
  const T = dates.length;
  const N = tickers.length;
  const open = new Float64Array(T * N).fill(NaN);
  const close = new Float64Array(T * N).fill(NaN);
  const adjClose = new Float64Array(T * N).fill(NaN);
  const dividend = new Float64Array(T * N);

  series.forEach((s, j) => {
    const currency = s.currency ?? baseCurrency;
    let rate: (date: string) => number = () => 1;
    if (currency !== baseCurrency) {
      const points = fx[currency];
      if (!points) {
        throw new Error(`${s.ticker} is priced in ${currency}; a ${currency}→${baseCurrency} FX series is required`);
      }
      rate = rateLookup(points, currency);
    }
    for (const b of s.bars) {
      const i = row.get(b.date)! * N + j;
      const r = rate(b.date);
      open[i] = b.open * r;
      close[i] = b.close * r;
      adjClose[i] = b.adjClose * r;
    }
    for (const d of s.dividends) {
      // Ex-dates are trading days for the ticker; fall forward if a feed disagrees.
      const t = dates.findIndex((date) => date >= d.date);
      if (t === -1) continue;
      dividend[t * N + j] += d.amount * (currency === baseCurrency ? 1 : rateLookup(fx[currency], currency)(dates[t]));
    }
  });

  return { dates, tickers, currency: baseCurrency, open, close, adjClose, dividend };
}
