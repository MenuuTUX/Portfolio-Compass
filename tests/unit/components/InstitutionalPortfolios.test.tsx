import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { BatchAddItem } from "@/hooks/useBatchAddPortfolio";
import { mockModule } from "@/tests/helpers/mock-module";

await mockModule("next/image", () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt} />,
}));
await mockModule("@/hooks/useDialogA11y", () => ({
  useDialogA11y: () => ({ current: null }),
}));
const { default: InstitutionalPortfolios } = await import("@/components/InstitutionalPortfolios");

function openFirstExample(onBatchAdd: (items: BatchAddItem[]) => Promise<void>) {
  render(<InstitutionalPortfolios onBatchAdd={onBatchAdd} />);
  fireEvent.click(screen.getByAltText("Wealthsimple"));
  return screen.getByRole("button", { name: "Load this allocation example" });
}

describe("InstitutionalPortfolios load status", () => {
  afterEach(cleanup);

  it("shows an accessible error and no success state when replacement rejects", async () => {
    const button = openFirstExample(async () => {
      throw new Error("Could not replace portfolio: valid quotes unavailable for VTI");
    });

    fireEvent.click(button);

    expect((await screen.findByRole("alert")).textContent).toContain("valid quotes unavailable for VTI");
    expect(screen.queryByText("Added to portfolio")).toBeNull();
  });

  it("shows success only after replacement resolves", async () => {
    let resolveAdd!: () => void;
    const button = openFirstExample(() => new Promise<void>((resolve) => { resolveAdd = resolve; }));

    fireEvent.click(button);
    expect(screen.queryByText("Added to portfolio")).toBeNull();
    resolveAdd();

    expect(await screen.findByText("Added to portfolio")).toBeTruthy();
  });
});
