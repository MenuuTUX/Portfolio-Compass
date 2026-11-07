import { afterAll, beforeEach, describe, expect, it, setSystemTime } from "bun:test";
import { mockModule } from "@/tests/helpers/mock-module";
import { createFakeYahoo } from "@/tests/helpers/fake-yahoo";

const yahoo = createFakeYahoo();
const { quote: mockQuote, chart: mockChart } = yahoo;

await mockModule("yahoo-finance2", () => ({ default: yahoo.FakeYahooFinance }));

// @ts-expect-error bun resolves the query suffix; tsc does not
const fastMarket: typeof import("@/lib/fast-market") = await import("@/lib/fast-market?audit");
const { mapQuote, getFastCandles, invalidateMarketCache } = fastMarket;

// Sunday 8 November 2026, 15:00 UTC. The last trading day is Friday 6 November.
const SUNDAY = new Date("2026-11-08T15:00:00Z").getTime();

beforeEach(() => {
  setSystemTime(new Date(SUNDAY));
  mockChart.mockReset();
  mockQuote.mockReset();
  invalidateMarketCache();
});
afterAll(() => setSystemTime());

describe("mapQuote change fields (API-B14)", () => {
  it("computes the change from price and previous close when Yahoo omits it", () => {
    const quote = mapQuote({
      symbol: "XYZ",
      regularMarketPrice: 105,
      regularMarketPreviousClose: 100,
    });
    expect(quote.change).toBeCloseTo(5, 6);
    expect(quote.changePercent).toBeCloseTo(5, 6);
  });

  it("keeps Yahoo's own percent when only the absolute change is missing", () => {
    const quote = mapQuote({
      symbol: "XYZ",
      regularMarketPrice: 105,
      regularMarketPreviousClose: 100,
      regularMarketChangePercent: 4.9,
    });
    expect(quote.changePercent).toBe(4.9);
    expect(quote.change).toBeCloseTo(5, 6);
  });

  it("shows zero only when there is no data to compute the change from", () => {
    const quote = mapQuote({ symbol: "XYZ", regularMarketPrice: 105 });
    expect(quote.changePercent).toBe(0);
    expect(quote.change).toBe(0);
  });
});

describe("invalidateMarketCache ticker matching (API-B20)", () => {
  const bar = (date: string) => ({ date: new Date(date), open: 1, high: 2, low: 1, close: 2 });

  it("purges only the ticker position, so tickers MAX and 1M leave range keys alone", async () => {
    mockChart.mockImplementation(async () => ({ quotes: [bar("2026-11-06T15:00:00Z")] }));

    await getFastCandles("AAPL", "MAX");
    await getFastCandles("MAX", "1Y");
    await getFastCandles("AAPL", "1M");
    await getFastCandles("1M", "1Y");
    expect(mockChart.mock.calls.length).toBe(4);

    invalidateMarketCache(["MAX", "1M"]);
    mockChart.mockClear();

    await getFastCandles("AAPL", "MAX");
    await getFastCandles("AAPL", "1M");
    expect(mockChart.mock.calls.length).toBe(0);

    await getFastCandles("MAX", "1Y");
    await getFastCandles("1M", "1Y");
    expect(mockChart.mock.calls.length).toBe(2);
  });

  it("still purges a ticker's own keys in every namespace", async () => {
    mockChart.mockImplementation(async () => ({ quotes: [bar("2026-11-06T15:00:00Z")] }));
    await getFastCandles("AAPL", "1Y");
    invalidateMarketCache(["aapl"]);
    mockChart.mockClear();
    await getFastCandles("AAPL", "1Y");
    expect(mockChart.mock.calls.length).toBe(1);
  });
});

describe("getFastCandles 1D range (API-B13)", () => {
  it("asks Yahoo for the last five calendar days, so weekends still return the last session", async () => {
    mockChart.mockResolvedValue({ quotes: [] });
    await getFastCandles("AAPL", "1D");
    const { period1 } = mockChart.mock.calls[0][1] as { period1: Date };
    const daysBack = (SUNDAY - period1.getTime()) / 86_400_000;
    expect(daysBack).toBeGreaterThanOrEqual(4.9);
    expect(daysBack).toBeLessThanOrEqual(5.1);
  });

  it("keeps only the most recent trading day's bars", async () => {
    mockChart.mockResolvedValue({
      quotes: [
        { date: new Date("2026-11-05T14:30:00Z"), open: 1, high: 1, low: 1, close: 1 },
        { date: new Date("2026-11-05T20:55:00Z"), open: 1, high: 1, low: 1, close: 1 },
        { date: new Date("2026-11-06T14:30:00Z"), open: 2, high: 2, low: 2, close: 2 },
        { date: new Date("2026-11-06T15:00:00Z"), open: 3, high: 3, low: 3, close: 3 },
      ],
    });
    const candles = await getFastCandles("AAPL", "1D");
    expect(candles.map((c) => c.date)).toEqual([
      "2026-11-06T14:30:00.000Z",
      "2026-11-06T15:00:00.000Z",
    ]);
  });
});
