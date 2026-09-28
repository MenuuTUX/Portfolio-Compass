import { describe, expect, it } from "bun:test";
import { isExtendedMarketSession } from "@/lib/quote-session";
import { mapQuote, quoteToAsset } from "@/lib/fast-market";

describe("extended-hours quote selection", () => {
  it("uses the provider's pre-market price and timestamp when the market is pre-market", () => {
    const quote = mapQuote({
      symbol: "ABC",
      quoteType: "EQUITY",
      marketState: "PRE",
      regularMarketPrice: 100,
      regularMarketTime: new Date("2026-09-25T20:00:00.000Z"),
      regularMarketChange: 0,
      regularMarketChangePercent: 0,
      preMarketPrice: 102,
      preMarketTime: new Date("2026-09-28T12:30:00.000Z"),
      preMarketChange: 2,
      preMarketChangePercent: 2,
    });

    expect(quote.price).toBe(102);
    expect(quote.changePercent).toBe(2);
    expect(quote.quoteSession).toBe("pre-market");
    expect(quote.quoteAsOf).toBe("2026-09-28T12:30:00.000Z");
    expect(quoteToAsset(quote).quoteSession).toBe("pre-market");
  });

  it("does not reuse an old after-hours price when Yahoo marks the market closed", () => {
    const quote = mapQuote({
      symbol: "ABC",
      quoteType: "ETF",
      marketState: "CLOSED",
      regularMarketPrice: 100,
      regularMarketTime: new Date("2026-09-25T20:00:00.000Z"),
      postMarketPrice: 105,
      postMarketTime: new Date("2026-09-25T23:00:00.000Z"),
    });

    expect(quote.price).toBe(100);
    expect(quote.quoteSession).toBe("closed");
    expect(quote.quoteAsOf).toBe("2026-09-25T20:00:00.000Z");
  });

  it("uses the current after-hours quote while Yahoo reports the post-market state", () => {
    const quote = mapQuote({
      symbol: "ABC",
      quoteType: "ETF",
      marketState: "POST",
      regularMarketPrice: 100,
      regularMarketTime: new Date("2026-09-28T20:00:00.000Z"),
      postMarketPrice: 99,
      postMarketTime: new Date("2026-09-28T21:30:00.000Z"),
      postMarketChange: -1,
      postMarketChangePercent: -1,
    });

    expect(quote.price).toBe(99);
    expect(quote.changePercent).toBe(-1);
    expect(quote.quoteSession).toBe("after-hours");
    expect(quote.quoteAsOf).toBe("2026-09-28T21:30:00.000Z");
  });
});

describe("extended market refresh window", () => {
  it("covers weekday extended hours in Eastern time, including DST", () => {
    expect(isExtendedMarketSession(new Date("2026-09-28T08:00:00.000Z"))).toBe(true);
    expect(isExtendedMarketSession(new Date("2026-09-28T23:59:00.000Z"))).toBe(true);
    expect(isExtendedMarketSession(new Date("2026-09-29T00:00:00.000Z"))).toBe(false);
  });

  it("does not poll on weekends", () => {
    expect(isExtendedMarketSession(new Date("2026-09-27T14:00:00.000Z"))).toBe(false);
  });
});
