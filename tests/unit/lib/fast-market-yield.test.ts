import { describe, expect, it } from "bun:test";
import { mapQuote, quoteToAsset } from "@/lib/fast-market";
import { getSourcedYield } from "@/lib/yield-provenance";
import { ETFSchema } from "@/schemas/assetSchema";
import recordedYahooQuotes from "@/tests/fixtures/yahoo-dividend-yield-percentage.json";

describe("Yahoo dividend yield units", () => {
  it("keeps recorded quote fields in their documented units", () => {
    const mapped = recordedYahooQuotes.quotes.map(mapQuote);
    const quotes = new Map(mapped.map((quote) => [quote.ticker, quote]));

    expect(quotes.get("AAPL")?.dividendYield).toBe(0.32);
    expect(quotes.get("SPY")?.dividendYield).toBe(0.98);
    expect(quotes.get("XIC.TO")?.dividendYield).toBe(1.94);
    expect(quotes.get("QQQ")?.dividendYield).toBeCloseTo(1.4);
    expect(quotes.get("QQQ")?.dividendYieldField).toBe("trailingAnnualDividendYield");
    expect(quotes.get("QQQ")?.dividendYieldInputUnit).toBe("fraction");
    expect(quotes.get("SPY")?.dividendYieldField).toBe("dividendYield");
    expect(quotes.get("SPY")?.dividendYieldInputUnit).toBe("percent");

    const spy = quotes.get("SPY")!;
    expect(quoteToAsset(spy).metrics).toMatchObject({
      yieldRetrievedAt: spy.retrievedAt ?? null,
      yieldSourceField: "dividendYield",
      yieldInputUnit: "percent",
      yieldNormalization: "already percent",
      yieldMeasurementDate: null,
    });
    expect(quoteToAsset(quotes.get("QQQ")!).metrics).toMatchObject({
      yieldSourceField: "trailingAnnualDividendYield",
      yieldInputUnit: "fraction",
      yieldNormalization: "fraction × 100 to percent",
      yieldMeasurementDate: null,
    });
  });

  it("does not assert that a Yahoo zero means a verified zero yield", () => {
    const quote = mapQuote({
      symbol: "ZERO", quoteType: "ETF", regularMarketPrice: 100,
      dividendYield: 0,
    });
    expect(quote.dividendYield).toBeUndefined();
    expect(quote.dividendYieldField).toBeUndefined();
    expect(quote.dividendYieldInputUnit).toBeUndefined();
    expect(quoteToAsset(quote).metrics).toMatchObject({
      yield: null,
      yieldSource: null,
      yieldSourceField: null,
      yieldInputUnit: null,
      yieldNormalization: null,
      yieldMeasurementDate: null,
    });
  });

  it("shows a trailing yield from complete distributions, including a known zero", () => {
    const aapl = mapQuote(recordedYahooQuotes.quotes[0]);
    const date = new Date().toISOString();
    const paying = quoteToAsset(aapl, [], [{ date, amount: 1 }]);
    expect(paying.metrics.yield).toBe(1);
    expect(paying.metrics.yieldSource).toBe("Yahoo Finance dividend history (TTM)");
    expect(getSourcedYield(paying.metrics)).toBe(1);
    expect(ETFSchema.parse(paying).metrics.yieldNormalization).toContain("cash distributions");

    const nonPaying = quoteToAsset(aapl, [], []);
    expect(nonPaying.metrics.yield).toBe(0);
    expect(getSourcedYield(nonPaying.metrics)).toBe(0);

    const unavailable = quoteToAsset(aapl, [], null);
    expect(unavailable.metrics.yieldSource).toBe("Yahoo Finance quote");
    expect(getSourcedYield(unavailable.metrics)).toBeNull();
  });
});
