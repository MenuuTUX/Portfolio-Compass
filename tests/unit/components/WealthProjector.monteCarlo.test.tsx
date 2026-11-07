import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Portfolio } from "@/types";
import { mockModule } from "@/tests/helpers/mock-module";

type SimulatorProps = Record<string, unknown>;
const simulatorRenders: SimulatorProps[] = [];

await mockModule("@/components/simulation/MonteCarloSimulator", () => ({
  default: (props: SimulatorProps) => {
    simulatorRenders.push(props);
    return <div>Simulator stub</div>;
  },
}));
const { default: WealthProjector } = await import("@/components/WealthProjector");

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

function openMonteCarlo(startingValue: number) {
  render(<WealthProjector portfolio={portfolio} startingValue={startingValue} baseCurrency="CAD" />);
  fireEvent.click(screen.getByRole("button", { name: /Use Monte Carlo model/ }));
  return simulatorRenders[simulatorRenders.length - 1];
}

beforeEach(() => {
  simulatorRenders.length = 0;
});
afterEach(cleanup);

describe("WealthProjector hands its inputs to Monte Carlo", () => {
  it("passes the simple-mode contribution, 2% default inflation and no goal", () => {
    render(<WealthProjector portfolio={portfolio} startingValue={5000} baseCurrency="CAD" />);
    fireEvent.change(screen.getByLabelText("Monthly Contribution (CAD)"), { target: { value: "750" } });
    fireEvent.click(screen.getByRole("button", { name: /Use Monte Carlo model/ }));

    const props = simulatorRenders[simulatorRenders.length - 1];
    expect(props.startingValue).toBe(5000);
    expect(props.monthlyContribution).toBe(750);
    expect(props.inflationPercent).toBe(2);
    expect(props.goalAmount).toBeUndefined();
  });

  it("passes edited contribution, inflation and goal values", () => {
    const props = openMonteCarlo(5000);
    expect(props.monthlyContribution).toBe(500);

    fireEvent.change(screen.getByLabelText("Monthly Contribution (CAD)"), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText("Inflation (%)"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Goal Amount (CAD)"), { target: { value: "250000" } });

    const latest = simulatorRenders[simulatorRenders.length - 1];
    expect(latest.monthlyContribution).toBe(300);
    expect(latest.inflationPercent).toBe(0);
    expect(latest.goalAmount).toBe(250000);
  });

  it("asks for a starting balance above 0 instead of rendering the simulator", () => {
    openMonteCarlo(0);
    expect(screen.getByText("Enter a starting balance above 0")).toBeTruthy();
    expect(simulatorRenders.length).toBe(0);
  });
});
