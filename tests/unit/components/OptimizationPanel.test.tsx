import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { PortfolioItem } from "@/types";
import { mockModule } from "@/tests/helpers/mock-module";

await mockModule("@/lib/math/covariance", () => ({
  estimateAnnualCovariance: () => ({
    matrix: [[0.02, 0.005], [0.005, 0.03]],
    source: "single-index",
    samples: 0,
  }),
}));

import OptimizationPanel from "@/components/OptimizationPanel";

describe("OptimizationPanel", () => {
  afterEach(cleanup);

  it("shows the experimental score without an apply action", async () => {
    const portfolio = [{
      ticker: "TEST",
      name: "Test fund",
      price: 100,
      currency: "USD",
      quoteStatus: "ok",
      changePercent: 0,
      history: [],
      metrics: { yield: 1.5, yieldSource: "Issuer factsheet" },
      allocation: { equities: 100, bonds: 0, cash: 0 },
      beta: 1,
      weight: 1,
      shares: 10,
    }, {
      ticker: "SECOND",
      name: "Second fund",
      price: 80,
      currency: "USD",
      quoteStatus: "ok",
      changePercent: 0,
      history: [],
      metrics: { yield: 1.2, yieldSource: "Issuer factsheet" },
      allocation: { equities: 100, bonds: 0, cash: 0 },
      beta: 0.8,
      weight: 1,
      shares: 5,
    }] as unknown as PortfolioItem[];

    render(<OptimizationPanel portfolio={portfolio} />);

    expect(await screen.findByText("Current score")).toBeTruthy();
    expect(screen.getByText("Model candidate score")).toBeTruthy();
    expect(screen.getByText(/Experimental score only/)).toBeTruthy();
    expect(screen.getByText("Maximum portfolio value for this comparison")).toBeTruthy();
    expect(screen.getByText(/Unallocated cash under cap/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /apply/i })).toBeNull();
  });

  it("scores funds with a TTM yield and estimated beta, shows their sources, and counts a gold fund's mix as known", async () => {
    const fund = (ticker: string, price: number, yieldPct: number, beta: number, allocation: PortfolioItem["allocation"]) => ({
      ticker, name: ticker, price, currency: "USD", quoteStatus: "ok", changePercent: 0, history: [],
      metrics: {
        yield: yieldPct,
        yieldSource: "Yahoo Finance dividend history (TTM)",
        betaSource: "Estimated vs SPY from 249 daily total returns",
      },
      allocation, beta, weight: 50, shares: 0,
    });
    const portfolio = [
      fund("VOO", 500, 1.12, 1, { equities: 100, bonds: 0, cash: 0 }),
      fund("GLD", 250, 0, 0.12, { equities: 0, bonds: 0, cash: 0, other: 100 }),
    ] as unknown as PortfolioItem[];

    render(<OptimizationPanel portfolio={portfolio} />);

    expect(await screen.findByText("Equity share after proposal")).toBeTruthy();
    expect(screen.queryByText("Experimental score unavailable")).toBeNull();
    expect(screen.getAllByText(/Yahoo Finance dividend history \(TTM\)\), beta/)).toHaveLength(2);
    expect(screen.getAllByText(/Estimated vs SPY from 249 daily total returns/)).toHaveLength(2);
  });

  it("hides the equity share row when a holding's mix is missing", async () => {
    const portfolio = [{
      ticker: "A", name: "A", price: 100, currency: "USD", changePercent: 0, history: [],
      metrics: { yield: 1, yieldSource: "Yahoo Finance dividend history (TTM)" },
      allocation: { equities: 100, bonds: 0, cash: 0 }, beta: 1, weight: 50, shares: 0,
    }, {
      ticker: "B", name: "B", price: 100, currency: "USD", changePercent: 0, history: [],
      metrics: { yield: 3, yieldSource: "Yahoo Finance dividend history (TTM)" },
      allocation: null, beta: 0.1, weight: 50, shares: 0,
    }] as unknown as PortfolioItem[];

    render(<OptimizationPanel portfolio={portfolio} />);

    expect(await screen.findByText("Current score")).toBeTruthy();
    expect(screen.queryByText("Equity share after proposal")).toBeNull();
  });

  it("explains why one asset cannot produce an allocation decision", () => {
    const portfolio = [{
      ticker: "TEST", name: "Test fund", price: 100, currency: "USD",
      changePercent: 0, history: [], metrics: { yield: 1.5, yieldSource: "Issuer factsheet" },
      allocation: { equities: 100, bonds: 0, cash: 0 }, beta: 1, weight: 100, shares: 10,
    }] as unknown as PortfolioItem[];
    render(<OptimizationPanel portfolio={portfolio} />);
    expect(screen.getByText("Allocation score unavailable")).toBeTruthy();
    expect(screen.getByText(/Buying more of one asset leaves its model weight at 100%/)).toBeTruthy();
  });
});
