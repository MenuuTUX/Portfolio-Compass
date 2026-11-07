import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import SpHeatmap from "@/components/SpHeatmap";
import { withFetch } from "@/tests/helpers/fetch";

const originalRO = globalThis.ResizeObserver;
let created: Array<{ disconnected: boolean }> = [];

beforeEach(() => {
  created = [];
  class FakeResizeObserver {
    state = { disconnected: false };
    constructor(_cb: unknown) {
      created.push(this.state);
    }
    observe() {}
    unobserve() {}
    disconnect() {
      this.state.disconnected = true;
    }
  }
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  // Never resolves: keeps the component in its loading state for the test.
  withFetch(() => new Promise(() => {}));
});

afterEach(() => {
  cleanup();
  globalThis.ResizeObserver = originalRO;
});

describe("SpHeatmap", () => {
  it("disconnects its ResizeObserver when unmounted", () => {
    const { unmount } = render(<SpHeatmap />);
    expect(created.length).toBeGreaterThan(0);
    expect(created.every((o) => !o.disconnected)).toBe(true);
    unmount();
    expect(created.every((o) => o.disconnected)).toBe(true);
  });
});
