import { afterEach, describe, expect, it } from "bun:test";
import { loadUsdCadSeries } from "@/lib/lab/fx";
import { withFetch } from "@/tests/helpers/fetch";

function dayAfter(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A fake route: every business day gets a rate of 1.25 + 0.001 per day index, with call tracking. */
function fakeRoute(opts: { delayMs?: number; extra?: { date: string; usdCad: number }[] } = {}) {
  const urls: string[] = [];
  let active = 0;
  let maxActive = 0;
  const fetchJson = async (url: string): Promise<unknown> => {
    urls.push(url);
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, opts.delayMs ?? 1));
    active--;
    const params = new URL(url, "http://localhost").searchParams;
    const from = params.get("start_date")!;
    const to = params.get("end_date")!;
    const series: { date: string; usdCad: number }[] = [];
    for (let d = from; d <= to; d = dayAfter(d, 1)) {
      const day = new Date(`${d}T00:00:00Z`).getUTCDay();
      if (day !== 0 && day !== 6) series.push({ date: d, usdCad: 1.25 });
    }
    return { series: [...series, ...(opts.extra ?? [])] };
  };
  return { fetchJson, urls, maxActive: () => maxActive };
}

describe("loadUsdCadSeries", () => {
  it("starts 10 days before the requested start so the first bar has a rate", async () => {
    const route = fakeRoute();
    const out = await loadUsdCadSeries("2024-03-01", "2024-03-31", route.fetchJson);
    expect(route.urls).toHaveLength(1);
    expect(route.urls[0]).toContain("start_date=2024-02-20");
    expect(route.urls[0]).toContain("end_date=2024-03-31");
    expect(out[0].date <= "2024-03-01").toBe(true);
  });

  it("splits long ranges into windows of at most 700 days that cover the range without gaps", async () => {
    const route = fakeRoute();
    const out = await loadUsdCadSeries("2015-01-01", "2024-12-31", route.fetchJson);
    const windows = route.urls.map((u) => {
      const p = new URL(u, "http://localhost").searchParams;
      return [p.get("start_date")!, p.get("end_date")!];
    });
    windows.sort();
    for (const [from, to] of windows) {
      const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
      expect(days).toBeLessThanOrEqual(700);
    }
    expect(windows[0][0]).toBe("2014-12-22");
    expect(windows[windows.length - 1][1]).toBe("2024-12-31");
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i][0]).toBe(dayAfter(windows[i - 1][1], 1));
    }
    expect(out[out.length - 1].date).toBe("2024-12-31");
  });

  it("keeps at most three windows in flight", async () => {
    const route = fakeRoute({ delayMs: 5 });
    await loadUsdCadSeries("2010-01-01", "2024-12-31", route.fetchJson);
    expect(route.urls.length).toBeGreaterThan(3);
    expect(route.maxActive()).toBe(3);
  });

  it("returns rates as USD per CAD (the inverse of the route's CAD per USD), sorted and without duplicates", async () => {
    // The 2nd window overlaps the 1st on its boundary day; the same date must appear once.
    const route = fakeRoute({ extra: [{ date: "2014-12-31", usdCad: 1.25 }, { date: "2014-12-31", usdCad: 1.25 }] });
    const out = await loadUsdCadSeries("2014-12-01", "2016-06-30", route.fetchJson);
    const dates = out.map((p) => p.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect([...dates].sort()).toEqual(dates);
    expect(out[0].rate).toBeCloseTo(0.8, 10);
    expect(dates).toContain("2015-01-02");
  });

  it("ignores points with a missing or non-positive rate", async () => {
    // 2024-06-08 and 2024-06-09 are a Saturday and Sunday: only the bad points carry those dates.
    const route = fakeRoute({ extra: [{ date: "2024-06-08", usdCad: 0 }, { date: "2024-06-09", usdCad: Number.NaN }] });
    const out = await loadUsdCadSeries("2024-06-01", "2024-06-09", route.fetchJson);
    expect(out.map((p) => p.date)).not.toContain("2024-06-08");
    expect(out.map((p) => p.date)).not.toContain("2024-06-09");
    expect(out.every((p) => Number.isFinite(p.rate) && p.rate > 0)).toBe(true);
  });

  it("reports a 4xx or 5xx from the route with a plain message", async () => {
    for (const status of [400, 502]) {
      withFetch(async () => new Response("{}", { status }));
      await expect(loadUsdCadSeries("2024-01-01", "2024-01-31")).rejects.toThrow(
        "Could not load USD/CAD exchange rates from 2023-12-22 to 2024-01-31. Try again in a minute.",
      );
    }
  });

  it("reports a network failure with the same plain message", async () => {
    withFetch(async () => { throw new TypeError("Failed to fetch"); });
    await expect(loadUsdCadSeries("2024-01-01", "2024-01-31")).rejects.toThrow("Could not load USD/CAD exchange rates");
  });
});
