// USD/CAD history for Compass Lab, from the Bank of Canada through
// /api/market/fx-history. The route answers at most two years per request, so
// the range is split into windows, fetched a few at a time and merged.

/** Rates as units of USD per one CAD, sorted by date, one point per date. */
export interface UsdPerCadPoint {
  date: string;
  rate: number;
}

const WINDOW_DAYS = 700;
/** Days before the requested start, so the first bar always has a rate on or before it. */
const LOOKBACK_DAYS = 10;
const MAX_IN_FLIGHT = 3;

export type FetchJson = (url: string) => Promise<unknown>;

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

function windowsFor(from: string, to: string): [string, string][] {
  const windows: [string, string][] = [];
  for (let s = from; s <= to; ) {
    const e = daysBetween(s, to) >= WINDOW_DAYS - 1 ? shiftDate(s, WINDOW_DAYS - 1) : to;
    windows.push([s, e]);
    s = shiftDate(e, 1);
  }
  return windows;
}

const defaultFetchJson: FetchJson = async (url) => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`fx-history returned ${res.status}`);
  return res.json();
};

/**
 * USD per one CAD, for every business day from ten days before `start` through `end`.
 * Throws a plain message when the rates cannot be loaded.
 */
export async function loadUsdCadSeries(
  start: string,
  end: string,
  fetchJson: FetchJson = defaultFetchJson,
): Promise<UsdPerCadPoint[]> {
  const from = shiftDate(start, -LOOKBACK_DAYS);
  const windows = windowsFor(from, end);
  const failure = `Could not load USD/CAD exchange rates from ${from} to ${end}. Try again in a minute.`;

  const bodies: unknown[] = new Array(windows.length);
  let next = 0;
  const worker = async () => {
    while (next < windows.length) {
      const i = next++;
      const [s, e] = windows[i];
      const params = new URLSearchParams({ start_date: s, end_date: e });
      bodies[i] = await fetchJson(`/api/market/fx-history?${params}`).catch(() => {
        throw new Error(failure);
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_IN_FLIGHT, windows.length) }, worker));

  const usdCadByDate = new Map<string, number>();
  for (const body of bodies) {
    const series = (body as { series?: unknown } | null)?.series;
    if (!Array.isArray(series)) throw new Error(failure);
    for (const point of series as { date?: unknown; usdCad?: unknown }[]) {
      const usdCad = Number(point?.usdCad);
      if (typeof point?.date === "string" && Number.isFinite(usdCad) && usdCad > 0) {
        usdCadByDate.set(point.date, usdCad);
      }
    }
  }

  return [...usdCadByDate]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, usdCad]) => ({ date, rate: 1 / usdCad }));
}
