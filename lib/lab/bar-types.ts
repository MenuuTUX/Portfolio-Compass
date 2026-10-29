// Shared by the server fetcher (lib/lab/bars.ts) and the browser cache
// (lib/lab/bar-cache.ts); keep this file free of server-only imports.

export interface DailyBar {
  /** Exchange-local trading date, YYYY-MM-DD. */
  date: string;
  open: number;
  /** Split-adjusted close (Yahoo `close`). */
  close: number;
  /** Split- and dividend-adjusted close (Yahoo `adjclose`). */
  adjClose: number;
}

export interface DividendEvent {
  date: string;
  /** Per share, in the same split-adjusted basis as `close`. */
  amount: number;
}

export interface SplitEvent {
  date: string;
  numerator: number;
  denominator: number;
}

export interface BarSource {
  provider: "Yahoo Finance";
  adjustment: "close: split-adjusted; adjClose: split- and dividend-adjusted";
  fetchedAt: string;
}

export interface BarSeries {
  ticker: string;
  currency: string | null;
  bars: DailyBar[];
  dividends: DividendEvent[];
  splits: SplitEvent[];
  source: BarSource;
}

/**
 * One ticker's full history as columns: the /api/market/bars payload and the
 * IndexedDB record. About a quarter of the size of `BarSeries` as JSON.
 */
export interface CompactSeries {
  v: 1;
  ticker: string;
  currency: string | null;
  /** Last completed session this history was built for; see lastCompletedSession. */
  through: string;
  source: BarSource;
  d: string[];
  o: number[];
  c: number[];
  a: number[];
  div: [date: string, amount: number][];
  split: [date: string, numerator: number, denominator: number][];
}

/** Eight significant digits: below a hundredth of a cent for any listed price. */
const round = (x: number) => Number(x.toPrecision(8));

export function toCompact(s: BarSeries, through: string): CompactSeries {
  return {
    v: 1,
    ticker: s.ticker,
    currency: s.currency,
    through,
    source: s.source,
    d: s.bars.map((b) => b.date),
    o: s.bars.map((b) => round(b.open)),
    c: s.bars.map((b) => round(b.close)),
    a: s.bars.map((b) => round(b.adjClose)),
    div: s.dividends.map((x) => [x.date, x.amount]),
    split: s.splits.map((x) => [x.date, x.numerator, x.denominator]),
  };
}

/** Expand a compact record, keeping only [start, end]. */
export function fromCompact(c: CompactSeries, start = "0000-00-00", end = "9999-99-99"): BarSeries {
  const bars: DailyBar[] = [];
  for (let i = 0; i < c.d.length; i++) {
    if (c.d[i] < start || c.d[i] > end) continue;
    bars.push({ date: c.d[i], open: c.o[i], close: c.c[i], adjClose: c.a[i] });
  }
  const inRange = (date: string) => date >= start && date <= end;
  return {
    ticker: c.ticker,
    currency: c.currency,
    bars,
    dividends: c.div.filter(([d]) => inRange(d)).map(([date, amount]) => ({ date, amount })),
    splits: c.split.filter(([d]) => inRange(d)).map(([date, numerator, denominator]) => ({ date, numerator, denominator })),
    source: c.source,
  };
}

// Freshness. The Lab backtests completed sessions only, so a ticker's history
// changes once a day and every user asks for the same URL that day. That one
// shared key per ticker is what lets the CDN absorb the traffic.

const NY = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

/** Hours after the 16:00 New York close before a day counts as complete (Yahoo settles adjusted closes late). */
const SETTLE_HOUR = 18;

function previousWeekday(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

/**
 * The latest US weekday session that has closed and settled, in New York time
 * (so daylight saving is handled). Market holidays are not modelled: on a
 * holiday this names the holiday, and the history simply ends the day before.
 */
export function lastCompletedSession(now = new Date()): string {
  const parts = Object.fromEntries(NY.formatToParts(now).map((p) => [p.type, p.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const settled = weekday !== 0 && weekday !== 6 && Number(parts.hour) >= SETTLE_HOUR;
  return settled ? today : previousWeekday(today);
}

/**
 * The server accepts the current session or the one before it (a client whose
 * clock or page is a little behind), nothing else, so each ticker has at most
 * two cache entries at a time.
 */
export function isAcceptedThrough(through: string, now = new Date()): boolean {
  const current = lastCompletedSession(now);
  return through === current || through === previousWeekday(current);
}
