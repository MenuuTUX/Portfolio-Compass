import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { loadPortfolio, savePortfolio } from "@/lib/storage";
import { mockModule } from "@/tests/helpers/mock-module";

await mockModule("@/hooks/useDialogA11y", () => ({
  useDialogA11y: () => ({ current: null }),
}));

const { default: SettingsDrawer } = await import("@/components/SettingsDrawer");

describe("SettingsDrawer portfolio backup", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it("previews before writing, then merges and refreshes the portfolio query", async () => {
    savePortfolio([{ ticker: "SPY", weight: 100, shares: 2 }]);
    queryClient.setQueryData(["portfolio"], [{ ticker: "SPY" }]);
    const query = queryClient.getQueryCache().find({ queryKey: ["portfolio"] });
    const invalidate = queryClient.invalidateQueries.bind(queryClient);
    let invalidated = false;
    queryClient.invalidateQueries = async (...args: Parameters<QueryClient["invalidateQueries"]>) => {
      invalidated = true;
      return invalidate(...args);
    };

    render(
      <QueryClientProvider client={queryClient}>
        <SettingsDrawer isOpen onClose={() => {}} />
      </QueryClientProvider>,
    );

    const file = new File([
      JSON.stringify([{ ticker: " voo ", weight: 40, shares: 3 }]),
    ], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Choose a backup file"), {
      target: { files: [file] },
    });

    expect(await screen.findByText(/Preview · 1 holding/)).toBeTruthy();
    expect(loadPortfolio()).toEqual([{ ticker: "SPY", weight: 100, shares: 2 }]);
    expect(invalidated).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Merge import" }));

    await waitFor(() => expect(loadPortfolio()).toEqual([
      { ticker: "SPY", weight: 100, shares: 2 },
      { ticker: "VOO", weight: 40, shares: 3 },
    ]));
    expect(invalidated).toBe(true);
    expect(query?.state.isInvalidated).toBe(true);
  });

  it("exports only validated locally stored ticker, weight, and share data", async () => {
    savePortfolio([{ ticker: " spy ", weight: 100, shares: 2 }]);
    queryClient.setQueryData(["portfolio"], [{
      ticker: "SPY",
      weight: 100,
      shares: 2,
      price: 600,
      currency: "USD",
      quoteAsOf: "2026-09-26T12:00:00.000Z",
      history: [{ date: "2026-09-25", price: 590 }],
    }]);
    let exported: Blob | undefined;
    let clicked: HTMLAnchorElement | undefined;
    const oldCreateObjectURL = URL.createObjectURL;
    const oldClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = ((blob: Blob) => {
      exported = blob;
      return "blob:portfolio-backup";
    }) as typeof URL.createObjectURL;
    HTMLAnchorElement.prototype.click = function () {
      clicked = this;
    };
    try {
      render(
        <QueryClientProvider client={queryClient}>
          <SettingsDrawer isOpen onClose={() => {}} />
        </QueryClientProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Export backup" }));

      expect(clicked?.download).toMatch(/^portfolio-compass-.*\.json$/);
      expect(exported?.type).toBe("application/json");
      expect(JSON.parse(await exported!.text())).toEqual([
        { ticker: "SPY", weight: 100, shares: 2 },
      ]);
    } finally {
      URL.createObjectURL = oldCreateObjectURL;
      HTMLAnchorElement.prototype.click = oldClick;
    }
  });

  it("rejects corrupt stored portfolio data instead of exporting an empty backup", () => {
    localStorage.setItem("portfolio_compass_v1", "not json");
    const oldCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = (() => {
      throw new Error("A download should not be created for corrupt data");
    }) as typeof URL.createObjectURL;
    try {
      render(
        <QueryClientProvider client={queryClient}>
          <SettingsDrawer isOpen onClose={() => {}} />
        </QueryClientProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Export backup" }));

      expect(screen.getByText(/Stored portfolio data is corrupted/)).toBeTruthy();
      expect(screen.queryByText(/Exported 0 local holdings/)).toBeNull();
    } finally {
      URL.createObjectURL = oldCreateObjectURL;
    }
  });

  it("preserves corrupt stored data when a merge restore is attempted", async () => {
    const corrupt = "not json";
    localStorage.setItem("portfolio_compass_v1", corrupt);
    render(
      <QueryClientProvider client={queryClient}>
        <SettingsDrawer isOpen onClose={() => {}} />
      </QueryClientProvider>,
    );

    const file = new File([
      JSON.stringify([{ ticker: "VOO", weight: 100, shares: 1 }]),
    ], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Choose a backup file"), {
      target: { files: [file] },
    });
    await screen.findByText(/Preview · 1 holding/);

    fireEvent.click(screen.getByRole("button", { name: "Merge import" }));

    expect(await screen.findByText(/Stored portfolio data is corrupted/)).toBeTruthy();
    expect(localStorage.getItem("portfolio_compass_v1")).toBe(corrupt);
  });

  it("requires an explicit replace action and confirms it before writing", async () => {
    savePortfolio([{ ticker: "SPY", weight: 100, shares: 2 }]);
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      render(
        <QueryClientProvider client={queryClient}>
          <SettingsDrawer isOpen onClose={() => {}} />
        </QueryClientProvider>,
      );
      const file = new File([
        JSON.stringify([{ ticker: "VOO", weight: 100, shares: 1 }]),
      ], "backup.json", { type: "application/json" });
      fireEvent.change(screen.getByLabelText("Choose a backup file"), {
        target: { files: [file] },
      });
      await screen.findByText(/Preview · 1 holding/);
      expect(loadPortfolio()).toEqual([{ ticker: "SPY", weight: 100, shares: 2 }]);

      fireEvent.click(screen.getByRole("button", { name: "Replace portfolio" }));
      await waitFor(() => expect(loadPortfolio()).toEqual([
        { ticker: "VOO", weight: 100, shares: 1 },
      ]));
    } finally {
      window.confirm = originalConfirm;
    }
  });

  it("leaves local data unchanged when the selected backup is malformed", async () => {
    savePortfolio([{ ticker: "SPY", weight: 100, shares: 2 }]);
    render(
      <QueryClientProvider client={queryClient}>
        <SettingsDrawer isOpen onClose={() => {}} />
      </QueryClientProvider>,
    );

    const file = new File(["not json"], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Choose a backup file"), {
      target: { files: [file] },
    });

    expect(await screen.findByText(/Unexpected token|JSON/)).toBeTruthy();
    expect(loadPortfolio()).toEqual([{ ticker: "SPY", weight: 100, shares: 2 }]);
    expect(screen.queryByRole("button", { name: "Merge import" })).toBeNull();
  });
});
