import { beforeEach, describe, expect, it, mock } from "bun:test";
import { mockModule } from "@/tests/helpers/mock-module";

const mockQuote = mock(async (..._args: unknown[]): Promise<unknown> => []);
const mockSearch = mock(async (..._args: unknown[]): Promise<unknown> => ({ quotes: [] }));

class FakeYahooFinance {
  quote = mockQuote;
  search = mockSearch;
  chart = mock(async () => ({ quotes: [] }));
  quoteSummary = mock(async () => ({}));
}

await mockModule("yahoo-finance2", () => ({ default: FakeYahooFinance }));

// The query string gives this file its own copy of the module, so its
// `new YahooFinance()` picks up the mock even if another test loaded the real one.
// @ts-expect-error bun resolves the query suffix; tsc does not
const fastMarket: typeof import("@/lib/fast-market") = await import("@/lib/fast-market?resilience");
const { getFastQuotes, searchFastSymbols, invalidateMarketCache } = fastMarket;

beforeEach(() => {
  mockQuote.mockReset();
  mockSearch.mockReset();
  invalidateMarketCache();
});

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

    mockQuote.mockResolvedValue([]);
    const quotes = await getFastQuotes(["NOPE"], { throwOnError: true });
    expect(quotes.size).toBe(0);
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
