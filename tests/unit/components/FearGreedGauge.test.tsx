import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import FearGreedGauge from "@/components/FearGreedGauge";

const originalFetch = globalThis.fetch;
let calls = 0;

beforeEach(() => {
  calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ score: 33, rating: "Fear", updatedAt: "2026-11-05T00:00:00Z" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

const provided = { score: 71, rating: "Greed", updatedAt: "2026-11-05T00:00:00Z" };

describe("FearGreedGauge data source", () => {
  it("does not fetch when the parent passes its own data", () => {
    render(<FearGreedGauge data={provided} compact />);
    expect(calls).toBe(0);
    expect(screen.getByLabelText(/Fear and Greed Index: 71, Greed/)).toBeTruthy();
  });

  it("fetches once when no data prop is given", async () => {
    render(<FearGreedGauge compact />);
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toBe(1);
  });
});
