import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { PortfolioItem } from "@/types";
import { mockModule } from "@/tests/helpers/mock-module";

await mockModule("next/image", () => ({ default: ({ alt }: { alt?: string }) => <img alt={alt} /> }));

const { default: PortfolioItemRow } = await import("@/components/PortfolioItemRow");

afterEach(cleanup);

describe("PortfolioItemRow memoization", () => {
  it("reflects a quote update that changes sourced yield and name at the same price", () => {
    const original = {
      ticker: "FUND",
      name: "Old fund name",
      price: 50,
      currency: "USD",
      quoteAsOf: "2026-09-26T10:00:00.000Z",
      quoteStatus: "ok",
      changePercent: 0,
      assetType: "ETF",
      history: [],
      metrics: { yield: 1.25, yieldSource: "Issuer factsheet" },
      allocation: { equities: 100, bonds: 0, cash: 0 },
      shares: 2,
      weight: 100,
    } as unknown as PortfolioItem;
    const props = {
      virtualRow: { index: 0 } as any,
      measureElement: () => {},
      onRemove: () => {},
      onUpdateWeight: () => {},
      onUpdateShares: () => {},
    };

    const view = render(<table><tbody><PortfolioItemRow item={original} {...props} /></tbody></table>);
    expect(screen.getByText("Old fund name")).toBeTruthy();
    expect(screen.getByText("1.25%")).toBeTruthy();

    const refreshed = {
      ...original,
      name: "Updated fund name",
      metrics: { yield: 2.75, yieldSource: "Issuer factsheet" },
    };
    view.rerender(<table><tbody><PortfolioItemRow item={refreshed} {...props} /></tbody></table>);

    expect(screen.getByText("Updated fund name")).toBeTruthy();
    expect(screen.getByText("2.75%")).toBeTruthy();
    expect(screen.queryByText("Old fund name")).toBeNull();
    expect(screen.queryByText("1.25%")).toBeNull();
  });
});
