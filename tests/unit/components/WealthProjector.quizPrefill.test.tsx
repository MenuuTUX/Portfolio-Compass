import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Portfolio } from "@/types";
import { mockModule } from "@/tests/helpers/mock-module";

await mockModule("@/components/simulation/MonteCarloSimulator", () => ({
  default: () => <div>Simulator stub</div>,
}));
const { default: WealthProjector } = await import("@/components/WealthProjector");

const KEY = "compass_risk_profile_v1";
const NOTE = "Started from your quiz answers";

const portfolio = [{
  ticker: "XIC.TO",
  name: "XIC",
  shares: 2,
  weight: 100,
  price: 57,
  currency: "CAD",
  quoteAsOf: new Date().toISOString(),
  changePercent: 0,
  assetType: "ETF",
  history: [],
  metrics: {},
  allocation: { equities: 100, bonds: 0, cash: 0 },
}] satisfies Portfolio;

const saveQuiz = (extra: Record<string, unknown>) => {
  localStorage.setItem(KEY, JSON.stringify({ profile: "Balanced", score: 55, takenAt: "", ...extra }));
};

const renderProjector = () => render(<WealthProjector portfolio={portfolio} startingValue={114} baseCurrency="CAD" />);
const horizonInput = () => document.getElementById("time-horizon") as HTMLInputElement;
const monthlyInput = () => screen.getByLabelText("Monthly Contribution (CAD)") as HTMLInputElement;

describe("WealthProjector prefilled from quiz answers", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("starts monthly contribution and time horizon from the quiz answers", () => {
    saveQuiz({ ageBand: "30-44", monthlyContribution: 750 });
    renderProjector();

    expect(monthlyInput().value).toBe("750");
    expect(horizonInput().value).toBe("28");
    expect(screen.getByText(NOTE)).toBeTruthy();
  });

  it("maps each age band to a time horizon, clamped between 5 and 30 years", () => {
    const expected: Record<string, string> = { "under-30": "30", "30-44": "28", "45-59": "13", "60-plus": "5" };
    for (const [ageBand, years] of Object.entries(expected)) {
      cleanup();
      localStorage.clear();
      saveQuiz({ ageBand });
      renderProjector();
      expect(horizonInput().value).toBe(years);
    }
  });

  it("prefills the goal amount for the Monte Carlo model", () => {
    saveQuiz({ goalAmount: 200000 });
    renderProjector();

    fireEvent.click(screen.getByRole("button", { name: "Use Monte Carlo model" }));
    expect((screen.getByLabelText("Goal Amount (CAD)") as HTMLInputElement).value).toBe("200000");
    expect(screen.getByText(NOTE)).toBeTruthy();
  });

  it("keeps the defaults and shows no note when nothing was saved", () => {
    renderProjector();

    expect(monthlyInput().value).toBe("500");
    expect(horizonInput().value).toBe("20");
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it("prefills only the values the quiz saved and keeps the rest at their defaults", () => {
    saveQuiz({ monthlyContribution: 300 });
    renderProjector();

    expect(monthlyInput().value).toBe("300");
    expect(horizonInput().value).toBe("20");
    expect(screen.getByText(NOTE)).toBeTruthy();
  });

  it("ignores invalid stored answers and shows no note for them", () => {
    saveQuiz({ ageBand: "teen", monthlyContribution: -40, goalAmount: "lots" });
    renderProjector();

    expect(monthlyInput().value).toBe("500");
    expect(horizonInput().value).toBe("20");
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it("never overwrites a value the user has edited", () => {
    saveQuiz({ ageBand: "30-44", monthlyContribution: 750 });
    const { rerender } = renderProjector();

    fireEvent.change(monthlyInput(), { target: { value: "900" } });
    fireEvent.change(horizonInput(), { target: { value: "10" } });
    rerender(<WealthProjector portfolio={portfolio} startingValue={120} baseCurrency="CAD" />);

    expect(monthlyInput().value).toBe("900");
    expect(horizonInput().value).toBe("10");
  });
});
