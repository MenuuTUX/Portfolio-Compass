import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PortfolioItem } from "@/types";

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
    // The holdings already have shares, so pick replace to test the whole-amount plan.
    fireEvent.click(screen.getByRole("radio", { name: "Replace my current shares" }));
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

  const mixFund = (ticker: string, price: number, beta: number, allocation: PortfolioItem["allocation"]) => ({
    ticker, name: ticker, price, currency: "USD", quoteStatus: "ok", changePercent: 0, history: [],
    metrics: { yield: 1, yieldSource: "Yahoo Finance dividend history (TTM)", betaSource: "Estimated vs SPY from 249 daily total returns" },
    allocation, beta, weight: 50, shares: 5,
  });

  it("shows stocks vs bonds when every holding reports a mix, counting a gold fund's mix as known", async () => {
    const portfolio = [
      mixFund("VOO", 500, 1, { equities: 100, bonds: 0, cash: 0 }),
      mixFund("GLD", 250, 0.12, { equities: 0, bonds: 0, cash: 0, other: 100 }),
    ] as unknown as PortfolioItem[];

    render(<OptimizationPanel portfolio={portfolio} />);
    fireEvent.click(screen.getByRole("radio", { name: "Replace my current shares" }));

    expect(await screen.findByText("Invested")).toBeTruthy();
    expect(screen.getByText("Stocks vs bonds")).toBeTruthy();
  });

  it("hides stocks vs bonds when a holding's mix is missing instead of reading it as 0% stocks", async () => {
    const portfolio = [
      mixFund("A", 100, 1, { equities: 100, bonds: 0, cash: 0 }),
      mixFund("B", 100, 0.1, null),
    ] as unknown as PortfolioItem[];

    render(<OptimizationPanel portfolio={portfolio} />);
    fireEvent.click(screen.getByRole("radio", { name: "Replace my current shares" }));

    expect(await screen.findByText("Invested")).toBeTruthy();
    expect(screen.queryByText("Stocks vs bonds")).toBeNull();
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

  const holding = (ticker: string, price: number, shares: number, extra: Record<string, unknown> = {}) => ({
    ticker, name: ticker, price, currency: "USD", quoteStatus: "ok", changePercent: 0,
    history: [], metrics: { yield: 1.5, yieldSource: "Issuer factsheet" },
    allocation: { equities: 100, bonds: 0, cash: 0 }, beta: 1, weight: 50, shares,
    ...extra,
  });
  const twoHoldings = () => [holding("TEST", 100, 10), holding("SECOND", 80, 5)] as unknown as PortfolioItem[];
  const valueOf = (plan: { ticker: string; shares: number }[], portfolio: PortfolioItem[]) =>
    plan.reduce((sum, p) => sum + p.shares * (portfolio.find((h) => h.ticker === p.ticker)?.price ?? 0), 0);

  it("adds new money to current holdings by default and applies current plus bought shares", async () => {
    const portfolio = twoHoldings();
    let applied: { ticker: string; shares: number; weight: number }[] | null = null;
    render(<OptimizationPanel portfolio={portfolio} onApply={(plan) => { applied = plan; }} />);

    expect(screen.getByRole("radio", { name: "New money added to my current holdings" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Replace my current shares" }).getAttribute("aria-checked")).toBe("false");
    expect(await screen.findByText("Current value")).toBeTruthy();
    expect(screen.getByText("New total")).toBeTruthy();

    fireEvent.click(await screen.findByRole("button", { name: "Use this allocation" }));
    const plan = applied!;
    // Shares start from the current holdings, so the plan never sells.
    expect(plan.find((p) => p.ticker === "TEST")!.shares).toBeGreaterThanOrEqual(10);
    expect(plan.find((p) => p.ticker === "SECOND")!.shares).toBeGreaterThanOrEqual(5);
    // Current value is 1,400; the new money is spent from the 10,000 amount.
    const newMoney = valueOf(plan, portfolio) - 1400;
    expect(newMoney).toBeGreaterThan(10000 - 80);
    expect(newMoney).toBeLessThanOrEqual(10000);
    expect(plan.reduce((sum, p) => sum + p.weight, 0)).toBeCloseTo(100, 6);
  });

  it("replaces current shares when that mode is chosen", async () => {
    const portfolio = twoHoldings();
    let applied: { ticker: string; shares: number; weight: number }[] | null = null;
    render(<OptimizationPanel portfolio={portfolio} onApply={(plan) => { applied = plan; }} />);

    fireEvent.click(screen.getByRole("radio", { name: "Replace my current shares" }));
    expect(screen.getByRole("radio", { name: "Replace my current shares" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(await screen.findByRole("button", { name: "Use this allocation" }));

    // The 10,000 amount is the whole portfolio, not new money on top of 1,400.
    const total = valueOf(applied!, portfolio);
    expect(total).toBeGreaterThan(10000 - 80);
    expect(total).toBeLessThanOrEqual(10000);
    expect(applied!.reduce((sum, p) => sum + p.weight, 0)).toBeCloseTo(100, 6);
  });

  it("explains that no plan is possible when no holding has a positive expected return", async () => {
    // Beta -1 gives 2% - 6% = -4% expected return, so cash beats every holding.
    const portfolio = [holding("S1", 100, 0, { assetType: "STOCK", beta: -1 }), holding("S2", 50, 0, { assetType: "STOCK", beta: -1 })] as unknown as PortfolioItem[];
    render(<OptimizationPanel portfolio={portfolio} onApply={() => {}} />);
    expect(await screen.findByText(/None of your funds has an expected return above zero/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Use this allocation" })).toBeNull();
  });

  it("explains when the amount cannot buy one whole share", async () => {
    const portfolio = twoHoldings();
    render(<OptimizationPanel portfolio={portfolio} onApply={() => {}} />);
    fireEvent.change(screen.getByLabelText("Amount to invest"), { target: { value: "10" } });
    expect(await screen.findByText(/too small to buy one whole share/)).toBeTruthy();
    expect(screen.getByText(/The cheapest share costs \D*80\.00\./)).toBeTruthy();
  });

  it("shows an inline error for an absurd amount and always clears calibrating", async () => {
    const portfolio = twoHoldings();
    const calibrating: boolean[] = [];
    render(<OptimizationPanel portfolio={portfolio} onCalibrating={(v) => calibrating.push(v)} />);
    fireEvent.change(screen.getByLabelText("Amount to invest"), { target: { value: "1e13" } });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("1 trillion or less");
    expect(screen.getByLabelText("Amount to invest").getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByRole("button", { name: "Use this allocation" })).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(calibrating[calibrating.length - 1]).toBe(false);
  });
});
