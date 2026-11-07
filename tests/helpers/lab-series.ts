import type { BarSeries } from "@/lib/lab/bar-types";

/** `n` consecutive weekdays starting 2010-01-01. */
export function weekdays(n: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(2010, 0, 1));
  while (out.length < n) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** A USD bar series with one bar per close on consecutive weekdays; open, high, low and adjClose equal the close. */
export function series(ticker: string, closes: number[]): BarSeries {
  const days = weekdays(closes.length);
  return {
    ticker,
    currency: "USD",
    bars: closes.map((c, i) => ({ date: days[i], open: c, high: c, low: c, close: c, adjClose: c, volume: null })),
    dividends: [],
    splits: [],
    source: { provider: "Yahoo Finance", adjustment: "close: split-adjusted; adjClose: split- and dividend-adjusted", fetchedAt: "test" },
  };
}
