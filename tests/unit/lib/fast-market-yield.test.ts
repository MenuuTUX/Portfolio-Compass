import { describe, expect, it } from "bun:test";
import { mapQuote, quoteToAsset } from "@/lib/fast-market";
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
});
