import { afterAll, beforeEach, describe, expect, it, mock, setSystemTime } from "bun:test";
import { mockModule } from "@/tests/helpers/mock-module";
import { createFakeYahoo } from "@/tests/helpers/fake-yahoo";

const yahoo = createFakeYahoo();
const { quote: mockQuote, search: mockSearch, chart: mockChart } = yahoo;

await mockModule("yahoo-finance2", () => ({ default: yahoo.FakeYahooFinance }));

// The query string gives this file its own copy of the module, so its
// `new YahooFinance()` picks up the mock even if another test loaded the real one.
// @ts-expect-error bun resolves the query suffix; tsc does not
const fastMarket: typeof import("@/lib/fast-market") = await import("@/lib/fast-market?resilience");
const { getFastQuotes, searchFastSymbols, invalidateMarketCache } = fastMarket;

// A failed quote call starts a short cooldown. Each test begins a minute later
// than the last so one test's failure never leaks into the next.
let clock = Date.now();
beforeEach(() => {
  clock += 60_000;
  setSystemTime(new Date(clock));
  mockQuote.mockReset();
  mockSearch.mockReset();
  mockChart.mockReset();
  invalidateMarketCache();
});
afterAll(() => setSystemTime());

describe("getFastQuotes resilience", () => {
  it("asks Yahoo not to schema-validate, so one odd symbol cannot drop the batch", async () => {
    mockQuote.mockResolvedValue([
      { symbol: "AAPL", regularMarketPrice: 190, quoteType: "EQUITY" },
      { symbol: "BRK-B" },
    ]);

    const quotes = await getFastQuotes(["AAPL", "BRK-B"]);

    expect(mockQuote.mock.calls[0][2]).toEqual({ validateResult: false });
    expect([...quotes.keys()]).toEqual(["AAPL"]);
  });

  it("still returns an empty map on upstream failure by default", async () => {
    mockQuote.mockRejectedValue(new Error("Too Many Requests"));
    const quotes = await getFastQuotes(["VOO"]);
    expect(quotes.size).toBe(0);
  });

  it("lets a caller tell an upstream failure from an unknown ticker", async () => {
    mockQuote.mockRejectedValue(new Error("Too Many Requests"));
    await expect(getFastQuotes(["VOO"], { throwOnError: true })).rejects.toThrow("Too Many Requests");

    // Past the cooldown a lookup that finds nothing is "unknown ticker", not an outage.
    setSystemTime(new Date(clock + 6_000));
    mockQuote.mockResolvedValue([]);
    const quotes = await getFastQuotes(["NOPE"], { throwOnError: true });
    expect(quotes.size).toBe(0);
  });
});

describe("getFastQuotes load protection", () => {
  it("makes one Yahoo call for identical concurrent lookups", async () => {
    mockQuote.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return [{ symbol: "AAPL", regularMarketPrice: 190, quoteType: "EQUITY" }];
    });

    const results = await Promise.all([1, 2, 3, 4, 5].map(() => getFastQuotes(["AAPL"], { bypassCache: true })));

    expect(mockQuote.mock.calls.length).toBe(1);
    for (const r of results) expect(r.get("AAPL")?.price).toBe(190);
  });

  it("does not call Yahoo again right after a failure", async () => {
    mockQuote.mockRejectedValue(new Error("Too Many Requests"));
    await getFastQuotes(["AAPL"]);
    await getFastQuotes(["MSFT"]);
    expect(mockQuote.mock.calls.length).toBe(1);
  });

  it("tries again once the cooldown has passed", async () => {
    mockQuote.mockRejectedValueOnce(new Error("Too Many Requests"));
    await getFastQuotes(["AAPL"]);

    setSystemTime(new Date(clock + 6_000));
    mockQuote.mockResolvedValue([{ symbol: "AAPL", regularMarketPrice: 190, quoteType: "EQUITY" }]);
    const quotes = await getFastQuotes(["AAPL"]);

    expect(quotes.get("AAPL")?.price).toBe(190);
  });
});

describe("searchFastSymbols resilience", () => {
  it("skips entries Yahoo returns without a symbol or quoteType", async () => {
    mockSearch.mockResolvedValue({
      quotes: [
        { symbol: "AAPL", quoteType: "EQUITY" },
        { index: "news", name: "Not a security", isYahooFinance: false },
        { symbol: "SPY", quoteType: "ETF" },
      ],
    });

    await expect(searchFastSymbols("apple")).resolves.toEqual(["AAPL", "SPY"]);
  });
});

describe("dividend histories", () => {
  const now = () => new Date(Date.now());
  const fullYearChart = () => ({
    quotes: [
      { date: new Date(now().getTime() - 400 * 864e5) },
      { date: new Date(now().getTime() - 864e5) },
    ],
    events: { dividends: [] },
  });
  const { getFastDividendHistories, getFastDividendHistory } = fastMarket;

  it("does not hold a response for lookups that are slow, and keeps them for next time", async () => {
    const chart = mock(async () => {
      await new Promise((r) => setTimeout(r, 80));
      return fullYearChart();
    });
    mockChart.mockImplementation(chart);

    const early = await getFastDividendHistories(["VOO"], { budgetMs: 10 });
    expect(early.has("VOO")).toBe(false);

    await new Promise((r) => setTimeout(r, 120));
    const later = await getFastDividendHistories(["VOO"], { budgetMs: 10 });
    expect(later.get("VOO")).toEqual([]);
    expect(chart.mock.calls.length).toBe(1);
  });

  it("remembers a failed lookup instead of asking Yahoo on every request", async () => {
    mockChart.mockImplementation(async () => { throw new Error("Too Many Requests"); });

    expect(await getFastDividendHistory("SPY")).toBeNull();
    expect(await getFastDividendHistory("SPY")).toBeNull();

    expect(mockChart.mock.calls.length).toBe(1);
  });
});
