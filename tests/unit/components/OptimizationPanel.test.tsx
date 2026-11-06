import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
import { saveRiskProfile } from "@/lib/risk-profile";

describe("OptimizationPanel", () => {
  afterEach(cleanup);

  it("builds a plan from an amount and applies it to every holding", async () => {
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

    let applied: { ticker: string; shares: number; weight: number }[] | null = null;
    render(<OptimizationPanel portfolio={portfolio} onApply={(plan) => { applied = plan; }} />);

    expect(screen.getByLabelText("Amount to invest")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Balanced" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(await screen.findByRole("button", { name: "Use this allocation" }));

    expect(applied).not.toBeNull();
    const plan = applied!;
    expect(plan.map((p) => p.ticker)).toEqual(["TEST", "SECOND"]);
    expect(plan.reduce((sum, p) => sum + p.weight, 0)).toBeCloseTo(100, 6);
    // Default amount is 10,000; whole shares leave under one share of cash.
    const invested = plan.reduce((sum, p) => sum + p.shares * (p.ticker === "TEST" ? 100 : 80), 0);
    expect(invested).toBeGreaterThan(10000 - 100);
    expect(invested).toBeLessThanOrEqual(10000);
  });

  it("explains why one asset cannot produce an allocation decision", () => {
    const portfolio = [{
      ticker: "TEST", name: "Test fund", price: 100, currency: "USD",
      changePercent: 0, history: [], metrics: { yield: 1.5, yieldSource: "Issuer factsheet" },
      allocation: { equities: 100, bonds: 0, cash: 0 }, beta: 1, weight: 100, shares: 10,
    }] as unknown as PortfolioItem[];
    render(<OptimizationPanel portfolio={portfolio} />);
    expect(screen.getByText("Add at least two holdings")).toBeTruthy();
  });

  it("starts at the risk level from the saved quiz result", () => {
    localStorage.clear();
    saveRiskProfile({ profile: "Conservative", score: 20 });
    const portfolio = [{
      ticker: "A", name: "A", price: 100, currency: "USD", quoteStatus: "ok", changePercent: 0,
      history: [], metrics: { yield: 1, yieldSource: "Issuer factsheet" },
      allocation: { equities: 100, bonds: 0, cash: 0 }, beta: 1, weight: 50, shares: 1,
    }, {
      ticker: "B", name: "B", price: 50, currency: "USD", quoteStatus: "ok", changePercent: 0,
      history: [], metrics: { yield: 3, yieldSource: "Issuer factsheet" },
      allocation: { equities: 0, bonds: 100, cash: 0 }, beta: 0.2, weight: 50, shares: 1,
    }] as unknown as PortfolioItem[];

    render(<OptimizationPanel portfolio={portfolio} />);

    expect(screen.getByRole("radio", { name: "Conservative" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Balanced" }).getAttribute("aria-checked")).toBe("false");
    localStorage.clear();
  });
});
