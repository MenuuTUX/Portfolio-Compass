import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import WealthProjector from "@/components/WealthProjector";
import type { Portfolio } from "@/types";

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

afterEach(cleanup);

describe("WealthProjector starting balance", () => {
  it("tracks quote changes until edited, then preserves the user's amount until Sync", () => {
    const { rerender } = render(
      <WealthProjector portfolio={portfolio} startingValue={114} baseCurrency="CAD" />,
    );
    const balance = screen.getByLabelText("Starting Balance (CAD)") as HTMLInputElement;
    expect(balance.value).toBe("114");

    rerender(<WealthProjector portfolio={portfolio} startingValue={120} baseCurrency="CAD" />);
    expect(balance.value).toBe("120");

    fireEvent.change(balance, { target: { value: "10000" } });
    rerender(<WealthProjector portfolio={portfolio} startingValue={125} baseCurrency="CAD" />);
    expect(balance.value).toBe("10000");

    fireEvent.click(screen.getByRole("button", { name: "Sync" }));
    expect(balance.value).toBe("125");
    rerender(<WealthProjector portfolio={portfolio} startingValue={130} baseCurrency="CAD" />);
    expect(balance.value).toBe("130");
  });

  it("starts at zero when held shares have zero current value", () => {
    render(<WealthProjector portfolio={portfolio} startingValue={0} baseCurrency="CAD" />);
    expect((screen.getByLabelText("Starting Balance (CAD)") as HTMLInputElement).value).toBe("0");
  });

  it("offers Monte Carlo for a freshly valued mixed portfolio", () => {
    const mixed = [
      portfolio[0],
      { ...portfolio[0], ticker: "VTI", currency: "USD", price: 100, shares: 1 },
    ] satisfies Portfolio;
    render(
      <WealthProjector
        portfolio={mixed}
        startingValue={314}
        baseCurrency="CAD"
        fxProvenance={{ date: new Date().toISOString().slice(0, 10), usdCad: 1.35 }}
      />,
    );
    expect((screen.getByRole("button", { name: /Use Monte Carlo model/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /Use Monte Carlo model/ }));
    expect(Boolean(screen.queryByText("Monte Carlo Simulation"))).toBe(true);
    expect(Boolean(screen.queryByText(/Historical USD\/CAD moves are included/i))).toBe(true);
  });
});
