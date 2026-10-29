import { describe, expect, it } from "bun:test";
import { FETCH_CONCURRENCY, loadBars, memoryBarStore, type FetchHistory, type FetchResult } from "@/lib/lab/bar-cache";
import type { CompactSeries } from "@/lib/lab/bar-types";

// Tuesday 2026-10-27 19:00 New York: the 27th has settled.
const TUESDAY = new Date("2026-10-27T23:00:00Z");
// Wednesday 2026-10-28 19:00 New York: a new session.
const WEDNESDAY = new Date("2026-10-28T23:00:00Z");

function compact(ticker: string, through: string, dates: string[], price = 100): CompactSeries {
  return {
    v: 1,
    ticker,
    currency: "USD",
    through,
    source: { provider: "Yahoo Finance", adjustment: "close: split-adjusted; adjClose: split- and dividend-adjusted", fetchedAt: "x" },
    d: dates,
    o: dates.map(() => price),
    c: dates.map(() => price),
    a: dates.map(() => price),
    div: [],
    split: [],
  };
}

/** A fake API: a fixed response per ticker, with call and concurrency tracking. */
function api(respond: (ticker: string, through: string, call: number) => FetchResult) {
  const calls: string[] = [];
  let active = 0;
  let maxActive = 0;
  const fetchOne: FetchHistory = async (ticker, through) => {
    calls.push(`${ticker}@${through}`);
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, 1));
    active--;
    return respond(ticker, through, calls.filter((c) => c.startsWith(`${ticker}@`)).length);
  };
  return { fetchOne, calls, maxActive: () => maxActive };
}

const DATES = ["2026-10-23", "2026-10-26", "2026-10-27"];
const ok = (ticker: string, through: string): FetchResult => ({ ok: true, series: compact(ticker, through, DATES) });
const noWait = async () => {};

describe("loadBars", () => {
  it("downloads each ticker once, then serves the same session from the store with no requests", async () => {
    const store = memoryBarStore();
    const { fetchOne, calls } = api(ok);
    const first = await loadBars(["SPY", "AGG"], "2026-10-01", "2026-10-29", { store, fetchOne, now: TUESDAY });
    expect(first.requests).toBe(2);
    expect(first.through).toBe("2026-10-27");
    expect(calls.sort()).toEqual(["AGG@2026-10-27", "SPY@2026-10-27"]);

    const again = await loadBars(["SPY", "AGG"], "2026-10-01", "2026-10-29", { store, fetchOne, now: TUESDAY });
    expect(again.requests).toBe(0);
    expect(again.series.map((s) => s.bars.length)).toEqual([3, 3]);
  });

  it("replaces the whole record once a new session has settled", async () => {
    const store = memoryBarStore();
    const { fetchOne, calls } = api((t, through) => ({ ok: true, series: compact(t, through, [...DATES, ...(through === "2026-10-28" ? ["2026-10-28"] : [])], through === "2026-10-28" ? 90 : 100) }));
    await loadBars(["SPY"], "2026-10-01", "2026-10-29", { store, fetchOne, now: TUESDAY });
    const next = await loadBars(["SPY"], "2026-10-01", "2026-10-29", { store, fetchOne, now: WEDNESDAY });
    expect(calls).toEqual(["SPY@2026-10-27", "SPY@2026-10-28"]);
    // Replaced, not merged: every bar is on the new basis.
    expect(next.series[0].bars.map((b) => b.adjClose)).toEqual([90, 90, 90, 90]);
    expect((await store.get("SPY"))!.through).toBe("2026-10-28");
  });

  it("rechecks a history that stops short of the session after 30 minutes, not all day", async () => {
    const store = memoryBarStore();
    // Yahoo has not settled the 27th yet: the history ends on the 26th.
    const { fetchOne, calls } = api((t, through) => ({ ok: true, series: compact(t, through, ["2026-10-23", "2026-10-26"]) }));
    await loadBars(["SPY"], "2026-10-01", "2026-10-29", { store, fetchOne, now: TUESDAY });
    await loadBars(["SPY"], "2026-10-01", "2026-10-29", { store, fetchOne, now: new Date(TUESDAY.getTime() + 29 * 60_000) });
    expect(calls).toHaveLength(1);
    await loadBars(["SPY"], "2026-10-01", "2026-10-29", { store, fetchOne, now: new Date(TUESDAY.getTime() + 31 * 60_000) });
    expect(calls).toHaveLength(2);
  });

  it("retries once with the session the server expects when the clocks disagree", async () => {
    const { fetchOne, calls } = api((t, through) =>
      through === "2026-10-27" ? { ok: false, status: 400, expected: "2026-10-26" } : ok(t, through));
    const out = await loadBars(["SPY"], "2026-10-01", "2026-10-29", { store: memoryBarStore(), fetchOne, now: TUESDAY });
    expect(calls).toEqual(["SPY@2026-10-27", "SPY@2026-10-26"]);
    expect(out.series).toHaveLength(1);
  });

  it("reports a ticker the API has no history for as missing", async () => {
    const { fetchOne } = api((t, th) => (t === "NOPE" ? { ok: false, status: 404 } : ok(t, th)));
    const out = await loadBars(["NOPE", "SPY"], "2026-10-01", "2026-10-29", { store: memoryBarStore(), fetchOne, now: TUESDAY });
    expect(out.series.map((s) => s.ticker)).toEqual(["SPY"]);
    expect(out.missing).toEqual(["NOPE"]);
    expect(out.failed).toEqual([]);
  });

  it("falls back to the previous session's copy when the server fails, and says so", async () => {
    const store = memoryBarStore();
    await loadBars(["SPY"], "2026-10-01", "2026-10-29", { store, fetchOne: api(ok).fetchOne, now: TUESDAY });
    const down = api(() => ({ ok: false, status: 502 }));
    const out = await loadBars(["SPY", "NEW"], "2026-10-01", "2026-10-29", { store, fetchOne: down.fetchOne, now: WEDNESDAY });
    expect(out.series.map((s) => s.ticker)).toEqual(["SPY"]);
    expect(out.failed.sort()).toEqual(["NEW", "SPY"]);
    // NEW never loaded, so it is a failure, not a ticker without data.
    expect(out.missing).toEqual([]);
  });

  it("retries once after a 429, waiting as told", async () => {
    const waits: number[] = [];
    const { fetchOne, calls } = api((t, th, n) => (n === 1 ? { ok: false, status: 429, retryAfter: 2 } : ok(t, th)));
    const out = await loadBars(["SPY"], "2026-10-01", "2026-10-29", {
      store: memoryBarStore(), fetchOne, now: TUESDAY, wait: async (ms) => void waits.push(ms),
    });
    expect(waits).toEqual([2000]);
    expect(calls).toHaveLength(2);
    expect(out.series).toHaveLength(1);
  });

  it(`keeps at most ${FETCH_CONCURRENCY} requests in flight`, async () => {
    const tickers = Array.from({ length: 20 }, (_, i) => `T${i}`);
    const tracker = api(ok);
    const out = await loadBars(tickers, "2026-10-01", "2026-10-29", { store: memoryBarStore(), fetchOne: tracker.fetchOne, now: TUESDAY, wait: noWait });
    expect(tracker.maxActive()).toBe(FETCH_CONCURRENCY);
    expect(out.series).toHaveLength(20);
  });

  it("slices to the requested range and reports a range with no bars as missing", async () => {
    const { fetchOne } = api(ok);
    const store = memoryBarStore();
    const out = await loadBars(["SPY"], "2026-10-26", "2026-10-26", { store, fetchOne, now: TUESDAY });
    expect(out.series[0].bars.map((b) => b.date)).toEqual(["2026-10-26"]);
    const empty = await loadBars(["SPY"], "2020-01-01", "2020-12-31", { store, fetchOne, now: TUESDAY });
    expect(empty.missing).toEqual(["SPY"]);
  });
});
