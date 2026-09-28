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
