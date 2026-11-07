import { afterEach, describe, expect, it } from "bun:test";
import { canonicalJson, runHash, sha256Hex } from "@/lib/lab/engine/run-hash";
import type { Frame } from "@/lib/lab/engine/frame";

const frame: Frame = {
  dates: ["2024-01-02", "2024-01-03"],
  tickers: ["SPY"],
  currency: "USD",
  open: new Float64Array([1, 2]),
  close: new Float64Array([1.5, 2.5]),
  adjClose: new Float64Array([1.25, 2.25]),
  dividend: new Float64Array([0, 0]),
};
const settings = { cash: 0, slippage: 0.001 };
const strategy = { code: "def decide(day): return 'SPY'", params: { lookback: 20 } };

const realSubtle = Object.getOwnPropertyDescriptor(globalThis.crypto, "subtle");

function withoutSubtle<T>(run: () => Promise<T>): Promise<T> {
  Object.defineProperty(globalThis.crypto, "subtle", { value: undefined, configurable: true });
  return run().finally(() => {
    if (realSubtle) Object.defineProperty(globalThis.crypto, "subtle", realSubtle);
    else delete (globalThis.crypto as unknown as Record<string, unknown>).subtle;
  });
}

afterEach(() => {
  if (realSubtle) Object.defineProperty(globalThis.crypto, "subtle", realSubtle);
});

describe("canonical JSON", () => {
  it("sorts keys by code unit, not by locale, so the order is the same everywhere", () => {
    // localeCompare would put "a" before "B"; code-unit order puts uppercase first.
    expect(canonicalJson({ b: 1, B: 2, a: 3 })).toBe('{"B":2,"a":3,"b":1}');
  });

  it("sorts nested objects too", () => {
    expect(canonicalJson({ z: { y: 1, x: 2 }, a: [{ d: 1, c: 2 }] })).toBe('{"a":[{"c":2,"d":1}],"z":{"x":2,"y":1}}');
  });
});

describe("sha256Hex fallback", () => {
  it("matches the published SHA-256 test vectors", () => {
    expect(sha256Hex(new Uint8Array(0))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("matches crypto.subtle across block boundaries", async () => {
    for (const n of [55, 56, 63, 64, 65, 1000, 4097]) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 31 + 7) % 256);
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
      expect(sha256Hex(bytes)).toBe(digest);
    }
  });
});

describe("runHash", () => {
  it("gives a 64-character hex digest", async () => {
    expect(await runHash(frame, settings, strategy)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not fail without crypto.subtle (plain HTTP origins) and gives the same hash", async () => {
    const withSubtle = await runHash(frame, settings, strategy);
    const fallback = await withoutSubtle(async () => {
      expect(globalThis.crypto.subtle).toBeUndefined();
      return runHash(frame, settings, strategy);
    });
    expect(fallback).toBe(withSubtle);
  });

  it("changes when the data changes", async () => {
    const changed = { ...frame, adjClose: new Float64Array([1.25, 2.26]) };
    expect(await runHash(changed, settings, strategy)).not.toBe(await runHash(frame, settings, strategy));
  });
});
