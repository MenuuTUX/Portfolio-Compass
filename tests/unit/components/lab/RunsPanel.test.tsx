import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RunsPanel from "@/components/lab/RunsPanel";
import type { LabRun } from "@/components/lab/useLabEngine";

const metrics = {
  startDate: "2019-01-02",
  endDate: "2024-01-02",
  totalReturn: 0.5,
  cagr: 0.08,
  volatility: 0.15,
  sharpe: 0.6,
  sortino: 0.8,
  maxDrawdown: { depth: 0.3, start: "2020-02-19", trough: "2020-03-23", recovery: "2021-01-08" },
  calmar: 0.27,
  positiveMonths: 0.6,
  turnover: 0.2,
  costsPaid: 12,
  dividendsReceived: 40,
  beta: 0.9,
  alpha: 0.01,
};

// Benchmark present, so the table shows Beta and Alpha too: 11 + 2 = 13 row headers.
const run = {
  id: 1,
  name: "Trend test",
  request: {},
  report: {
    metrics,
    benchmark: { ticker: "SPY", metrics: { ...metrics, sharpe: 0.5 } },
    currency: "USD",
    sim: { warnings: [] },
    hash: "0123456789abcdef0123456789abcdef",
  },
  dataFetchedAt: "2024-01-03T00:00:00.000Z",
} as unknown as LabRun;

const EXPECTED_ROW_HEADERS = [
  "Total return",
  "CAGR",
  "Volatility",
  "Sharpe",
  "Sortino",
  "Max drawdown",
  "Calmar",
  "Positive months",
  "Turnover",
  "Costs paid",
  "Dividends",
  "Beta",
  "Alpha",
];

function renderPanel() {
  return render(
    <RunsPanel
      runs={[run]}
      selectedId={1}
      compareIds={[]}
      onSelect={() => {}}
      onToggleCompare={() => {}}
    />,
  );
}

function tipTriggerIn(header: HTMLElement): HTMLElement {
  const el = header.querySelector('[tabindex="0"]');
  if (!(el instanceof HTMLElement)) throw new Error("no tip trigger in row header");
  return el;
}

afterEach(cleanup);

describe("Backtest Lab metrics table", () => {
  it("keeps the same 13 row headers in the same order", () => {
    renderPanel();
    const headers = screen.getAllByRole("rowheader");
    expect(headers.map((h) => h.textContent)).toEqual(EXPECTED_ROW_HEADERS);
  });

  it("uses each row label as the accessible name of its row header", () => {
    renderPanel();
    for (const name of EXPECTED_ROW_HEADERS) {
      expect(screen.getByRole("rowheader", { name })).toBeTruthy();
    }
  });

  it("shows the Sharpe explanation on focus", () => {
    renderPanel();
    const sharpe = screen.getByRole("rowheader", { name: "Sharpe" });
    const trigger = tipTriggerIn(sharpe);

    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.focus(trigger);

    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain("Sharpe Ratio");
    expect(tip.textContent).toContain("What it means");
    expect(trigger.getAttribute("aria-describedby")).toBe(tip.id);
  });

  it("shows the Sharpe explanation on hover", () => {
    renderPanel();
    const trigger = tipTriggerIn(screen.getByRole("rowheader", { name: "Sharpe" }));

    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip").textContent).toContain("Sharpe Ratio");
  });

  it("shows one tip per row, not a native title as well", () => {
    renderPanel();
    const sharpe = screen.getByRole("rowheader", { name: "Sharpe" });
    expect(sharpe.getAttribute("title")).toBeNull();
  });
});
