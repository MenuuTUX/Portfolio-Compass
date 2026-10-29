import { describe, expect, it, mock, beforeEach } from "bun:test";
import { NextRequest } from "next/server";
import { mockModule } from "@/tests/helpers/mock-module";
import { lastCompletedSession, type CompactSeries } from "@/lib/lab/bar-types";
import recorded from "@/tests/fixtures/yahoo-chart-daily.json";

type AsyncMockFn = (...args: any[]) => Promise<any>;
const mockChart = mock<AsyncMockFn>(async () => recorded.AAPL);

class MockYahooFinance {
  chart = mockChart;
}

await mockModule("yahoo-finance2", () => ({ default: MockYahooFinance }));

const { GET } = await import("../../../app/api/market/bars/route");

const get = (query: string) => GET(new NextRequest(`http://localhost/api/market/bars?${query}`));
const THROUGH = lastCompletedSession();

/** A chart whose sessions end exactly on `through`, plus one live bar after it. */
function chartThrough(through: string) {
  const at = (date: string) => `${date}T14:30:00Z`;
  const after = new Date(Date.parse(`${through}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return {
    meta: { currency: "USD", gmtoffset: -14400 },
    quotes: [
      { date: at("2020-01-02"), open: 10, close: 10, adjclose: 9 },
      { date: at(through), open: 11, close: 11, adjclose: 11 },
      { date: at(after), open: 12, close: 12, adjclose: 12 },
    ],
  };
}

describe("GET /api/market/bars", () => {
  beforeEach(() => {
    mockChart.mockClear();
    mockChart.mockImplementation(async () => recorded.AAPL);
  });

  it("rejects a bad ticker, and a through date other than the last two sessions without caching that answer", async () => {
    const bad = await get(`ticker=&through=${THROUGH}`);
    expect(bad.status).toBe(400);
    const stale = await get("ticker=AAPL&through=2020-01-02");
    expect(stale.status).toBe(400);
    expect(stale.headers.get("Vercel-CDN-Cache-Control")).toBe("no-store");
    expect((await stale.json()).expected).toBe(THROUGH);
    expect(mockChart).not.toHaveBeenCalled();
  });

  it("returns full compact history with CDN caching, completed sessions only", async () => {
    mockChart.mockImplementation(async () => chartThrough(THROUGH));
    const res = await get(`ticker=cmp1&through=${THROUGH}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as CompactSeries;
    expect(body.ticker).toBe("CMP1");
    expect(body.through).toBe(THROUGH);
    // The live bar after `through` is dropped.
    expect(body.d).toEqual(["2020-01-02", THROUGH]);
    expect(body.a).toEqual([9, 11]);
    expect(mockChart.mock.calls[0][1]).toMatchObject({ period1: "1970-01-01T00:00:00Z", interval: "1d", events: "div|split" });
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=86400, stale-while-revalidate=86400");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
  });

  it("caches a history that stops short of `through` for only half an hour", async () => {
    const res = await get(`ticker=SHORT1&through=${THROUGH}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=1800, stale-while-revalidate=86400");
  });

  it("returns a cacheable 404 when Yahoo has no such symbol", async () => {
    mockChart.mockImplementation(async () => { throw new Error("No data found, symbol may be delisted"); });
    const res = await get(`ticker=ZZZQQX&through=${THROUGH}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toContain("max-age=3600");
  });

  it("never caches an upstream failure", async () => {
    mockChart.mockImplementation(async () => { throw new Error("socket hang up"); });
    const res = await get(`ticker=DOWN1&through=${THROUGH}`);
    expect(res.status).toBe(502);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("no-store");
  });

  it("shares one upstream call between concurrent requests for the same ticker", async () => {
    mockChart.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return chartThrough(THROUGH);
    });
    const [a, b] = await Promise.all([get(`ticker=SAME1&through=${THROUGH}`), get(`ticker=SAME1&through=${THROUGH}`)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(mockChart).toHaveBeenCalledTimes(1);
  });
});
