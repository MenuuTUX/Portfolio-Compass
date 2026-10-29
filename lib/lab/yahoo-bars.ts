import type { BarSeries, DailyBar } from "@/lib/lab/bar-types";

// Pure mapping of yahoo-finance2 chart() output, kept apart from lib/lab/bars.ts
// so tests can use it without loading the Yahoo client.

/** A Yahoo daily timestamp as the trading date on the exchange's own clock. */
function exchangeDate(date: Date | number | string, gmtOffsetSeconds: number): string {
  return new Date(new Date(date).getTime() + gmtOffsetSeconds * 1000).toISOString().slice(0, 10);
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

interface YahooChartLike {
  meta?: { currency?: string | null; gmtoffset?: number | null };
  quotes?: {
    date: Date | number | string;
    open?: number | null;
    close?: number | null;
    adjclose?: number | null;
  }[];
  events?: {
    dividends?: { date: Date | number | string; amount: number }[];
    splits?: { date: Date | number | string; numerator: number; denominator: number }[];
  };
}

/** Normalize a yahoo-finance2 chart() result. Rows with a missing price are dropped, never zeroed. */
export function mapChartResult(
  ticker: string,
  res: YahooChartLike,
  fetchedAt: string,
): BarSeries {
  const offset = res.meta?.gmtoffset ?? 0;
  const byDate = new Map<string, DailyBar>();
  for (const q of res.quotes ?? []) {
    if (![q.open, q.close, q.adjclose].every(positive)) continue;
    // Yahoo can repeat the live session as a second row; the later row wins.
    const date = exchangeDate(q.date, offset);
    byDate.set(date, {
      date,
      open: q.open!,
      close: q.close!,
      adjClose: q.adjclose!,
    });
  }

  const byDateAsc = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);

  return {
    ticker,
    currency: res.meta?.currency ?? null,
    bars: [...byDate.values()].sort(byDateAsc),
    dividends: (res.events?.dividends ?? [])
      .filter((d) => positive(d.amount))
      .map((d) => ({ date: exchangeDate(d.date, offset), amount: d.amount }))
      .sort(byDateAsc),
    splits: (res.events?.splits ?? [])
      .filter((s) => positive(s.numerator) && positive(s.denominator))
      .map((s) => ({
        date: exchangeDate(s.date, offset),
        numerator: s.numerator,
        denominator: s.denominator,
      }))
      .sort(byDateAsc),
    source: {
      provider: "Yahoo Finance",
      adjustment: "close: split-adjusted; adjClose: split- and dividend-adjusted",
      fetchedAt,
    },
  };
}
