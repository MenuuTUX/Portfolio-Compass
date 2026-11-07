import { expect, it } from "bun:test";
import { mergeLocalPortfolio } from "@/hooks/usePortfolio";
import { toPortfolioEtf } from "@/hooks/normalize";
import type { ETF } from "@/types";

it("keeps stored holdings visible when a quote fails", () => {
  const available: ETF = {
    ticker: "AAPL",
    name: "Apple",
    price: 200,
    currency: "USD",
    changePercent: 0,
    history: [],
    metrics: { mer: 0, yield: 0 },
    allocation: { equities: 100, bonds: 0, cash: 0 },
  };
  const portfolio = mergeLocalPortfolio(
    [
      { ticker: "AAPL", shares: 2, weight: 50 },
      { ticker: "MISSING", shares: 3, weight: 50 },
    ],
    new Map([["AAPL", available]]),
  );

  expect(portfolio).toHaveLength(2);
  expect(portfolio[1].ticker).toBe("MISSING");
  expect(portfolio[1].shares).toBe(3);
  expect(portfolio[1].quoteStatus).toBe("unavailable");
});

it("keeps cached portfolio details while applying a fresh quote", () => {
  const previous: ETF = {
    ticker: "AAPL",
    name: "Apple",
    price: 100,
    quoteAsOf: "2026-09-25T20:00:00.000Z",
    quoteSession: "closed",
    changePercent: 0,
    history: [{ date: "2026-09-25", price: 100 }],
    metrics: { mer: 0, yield: 1 },
    allocation: { equities: 90, bonds: 10, cash: 0 },
    sector: "Technology",
  };
  const freshQuote: ETF = {
    ticker: "AAPL",
    name: "Apple Inc.",
    price: 102,
    quoteAsOf: "2026-09-28T12:30:00.000Z",
    quoteSession: "pre-market",
    changePercent: 2,
    history: [],
    metrics: { mer: null, yield: null },
    allocation: { equities: 0, bonds: 0, cash: 0 },
    sectors: {},
  };
  const previousPortfolioItem = { ...previous, weight: 100, shares: 2 };

  const [item] = mergeLocalPortfolio(
    [{ ticker: "AAPL", shares: 2, weight: 100 }],
    new Map([["AAPL", freshQuote]]),
    [previousPortfolioItem],
  );

  expect(item.price).toBe(102);
  expect(item.quoteSession).toBe("pre-market");
  expect(item.history).toEqual(previous.history);
  expect(item.metrics.yield).toBe(1);
  expect(item.allocation).toEqual(previous.allocation);
  expect(item.sector).toBe("Technology");
});

it("preserves explicit unknown yield and metric provenance during normalization", () => {
  const normalized = toPortfolioEtf({
    ticker: "TEST",
    metrics: {
      yield: null,
      yieldSource: "Yahoo Finance quote",
      yieldRetrievedAt: "2026-09-26T10:00:00.000Z",
      mer: 0.25,
    },
  }, "TEST");

  expect(normalized.metrics.yield).toBeNull();
  expect(normalized.metrics.yieldSource).toBe("Yahoo Finance quote");
  expect(normalized.metrics.mer).toBe(0.25);
});

it("replaces a stored all-zero asset mix with the fetched one, or with null when none was reported", () => {
  const stored = (ticker: string): ETF => ({
    ticker,
    name: ticker,
    price: 100,
    currency: "USD",
    changePercent: 0,
    history: [],
    metrics: { yield: 0, yieldSource: "Yahoo Finance dividend history (TTM)" },
    allocation: { equities: 0, bonds: 0, cash: 0 },
  });
  const fetched = (ticker: string, allocation: ETF["allocation"], beta?: number): ETF => ({
    ...stored(ticker),
    allocation,
    beta,
    metrics: { ...stored(ticker).metrics, betaSource: beta === undefined ? null : "Estimated vs SPY from 249 daily total returns" },
  });

  const portfolio = mergeLocalPortfolio(
    [
      { ticker: "GLD", shares: 1, weight: 50 },
      { ticker: "NOMIX", shares: 1, weight: 50 },
    ],
    new Map([
      ["GLD", stored("GLD")],
      ["NOMIX", stored("NOMIX")],
    ]),
    [
      { ...fetched("GLD", { equities: 0, bonds: 0, cash: 0, other: 100 }, 0.12), weight: 50, shares: 1 },
      { ...fetched("NOMIX", null), weight: 50, shares: 1 },
    ],
  );

  expect(portfolio[0].allocation).toEqual({ equities: 0, bonds: 0, cash: 0, other: 100 });
  expect(portfolio[0].beta).toBe(0.12);
  expect(portfolio[0].metrics.betaSource).toBe("Estimated vs SPY from 249 daily total returns");
  expect(portfolio[1].allocation).toBeNull();
});

it("normalizes a payload without an asset mix to null, not zeros", () => {
  expect(toPortfolioEtf({ ticker: "X", price: 1 }, "X").allocation).toBeNull();
  expect(toPortfolioEtf({ ticker: "GLD", price: 1, allocation: { equities: 0, bonds: 0, cash: 0, other: 100 } }, "GLD").allocation)
    .toEqual({ equities: 0, bonds: 0, cash: 0, other: 100 });
});
