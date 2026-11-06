import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PortfolioItem } from "@/types";
import { mockModule } from "@/tests/helpers/mock-module";

await mockModule("@/lib/math/covariance", () => ({
  estimateAnnualCovariance: () => ({
    matrix: [[0.02, 0.005], [0.005, 0.03]],
    // History source, so the "Risk comes from N overlapping daily returns" sentence renders.
    source: "history",
    samples: 250,
  }),
}));

import OptimizationPanel from "@/components/OptimizationPanel";

// The optimizer needs at least two holdings to show its form.
const holding = (ticker: string, price: number, beta: number, shares: number) => ({
  ticker,
  name: `${ticker} fund`,
  price,
  currency: "USD",
  quoteStatus: "ok",
  changePercent: 0,
  history: [],
  metrics: { yield: 1.5, yieldSource: "Issuer factsheet" },
  allocation: { equities: 100, bonds: 0, cash: 0 },
  beta,
  weight: 1,
  shares,
});
const portfolio = [holding("TEST", 100, 1, 10), holding("SECOND", 80, 0.8, 5)] as unknown as PortfolioItem[];

function tipTriggerFor(text: string): HTMLElement {
  const label = screen.getByText(text, { selector: "span,p,button" });
  const el = label.closest('[tabindex="0"]');
  if (!(el instanceof HTMLElement)) throw new Error(`no tip trigger for ${text}`);
  return el;
}

afterEach(cleanup);

describe("OptimizationPanel plain-language tips", () => {
  it("explains the risk level on focus and keeps the radio group named by it", () => {
    render(<OptimizationPanel portfolio={portfolio} />);

    expect(screen.getByRole("radiogroup", { name: "Risk level" })).toBeTruthy();

    fireEvent.focus(tipTriggerFor("Risk level"));
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain("Risk Level");
    expect(tip.textContent).toContain("What it means");
  });

  it("explains new money versus replacing shares from the mode caption", () => {
    render(<OptimizationPanel portfolio={portfolio} />);

    expect(screen.getByRole("radiogroup", { name: "How the amount is used" })).toBeTruthy();

    fireEvent.focus(tipTriggerFor("How the amount is used"));
    expect(screen.getByRole("tooltip").textContent).toContain("New Money");
  });

  it("explains expected return, volatility and diversification in How it works", () => {
    render(<OptimizationPanel portfolio={portfolio} />);

    const summary = screen.getByText("How it works");
    fireEvent.click(summary);

    for (const [term, label] of [
      ["expected return", "Expected Return"],
      ["volatility", "Volatility"],
      ["diversification", "Diversification"],
    ] as const) {
      const trigger = tipTriggerFor(term);
      fireEvent.focus(trigger);
      expect(screen.getByRole("tooltip").textContent).toContain(label);
      fireEvent.blur(trigger);
    }
  });
});
