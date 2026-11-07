import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PortfolioItem } from "@/types";
import { mockModule } from "@/tests/helpers/mock-module";

await mockModule("next/image", () => ({ default: ({ alt }: { alt?: string }) => <img alt={alt} /> }));

const { default: PortfolioItemRow } = await import("@/components/PortfolioItemRow");

afterEach(cleanup);

const item = {
  ticker: "FUND",
  name: "Fund",
  price: 50,
  currency: "USD",
  quoteAsOf: "2026-09-26T10:00:00.000Z",
  quoteStatus: "ok",
  changePercent: 0,
  assetType: "ETF",
  history: [],
  metrics: {},
  allocation: { equities: 100, bonds: 0, cash: 0 },
  shares: 3,
  weight: 100,
} as unknown as PortfolioItem;

function renderRow(onUpdateShares: (ticker: string, shares: number) => void) {
  return render(
    <ul>
      <PortfolioItemRow
        item={item}
        expanded
        onToggle={() => {}}
        onCollapse={() => {}}
        onRemove={() => {}}
        onUpdateWeight={() => {}}
        onUpdateShares={onUpdateShares}
      />
    </ul>,
  );
}

describe("PortfolioItemRow shares input", () => {
  it("lets the field be cleared and retyped, committing the new value", () => {
    const commits: number[] = [];
    renderRow((_, shares) => commits.push(shares));
    const input = screen.getByLabelText("Shares for FUND") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "" } });
    expect(commits).toEqual([]);
    expect(input.value).toBe("");

    fireEvent.change(input, { target: { value: "12" } });
    expect(commits).toEqual([12]);
    expect(input.value).toBe("12");
  });

  it("shows an error and does not commit a negative number", () => {
    const commits: number[] = [];
    renderRow((_, shares) => commits.push(shares));
    const input = screen.getByLabelText("Shares for FUND") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "-5" } });

    expect(commits).toEqual([]);
    expect(screen.getByText("Enter 0 or more")).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("min")).toBe("0");
  });

  it("reverts to the last valid share count when an invalid entry is left", () => {
    const commits: number[] = [];
    renderRow((_, shares) => commits.push(shares));
    const input = screen.getByLabelText("Shares for FUND") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "-5" } });
    fireEvent.blur(input);

    expect(input.value).toBe("3");
    expect(screen.queryByText("Enter 0 or more")).toBeNull();
    expect(commits).toEqual([]);
  });
});
