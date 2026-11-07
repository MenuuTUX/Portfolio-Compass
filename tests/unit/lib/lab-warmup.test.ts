import { describe, expect, it } from "bun:test";
import { warmupDaysFor } from "@/lib/lab/lab-form";

describe("warmupDaysFor", () => {
  it("covers a 200-day average and a 252-day lookback in calendar days", () => {
    expect(warmupDaysFor({ kind: "trend", allocation: { SPY: 1 }, smaDays: 200 })).toBeGreaterThanOrEqual(290);
    expect(warmupDaysFor({ kind: "momentum", universe: ["SPY"], lookbackDays: 252, top: 1, absolute: true })).toBeGreaterThanOrEqual(365);
  });

  it("sizes a sweep for its longest average", () => {
    const rule = { kind: "trend", allocation: { SPY: 1 }, smaDays: 50 } as const;
    expect(warmupDaysFor(rule, 300)).toBeGreaterThan(warmupDaysFor(rule));
  });

  it("needs none for a fixed allocation and a lot for code", () => {
    expect(warmupDaysFor({ kind: "fixed", allocation: { SPY: 1 } })).toBe(0);
    expect(warmupDaysFor({ kind: "code", language: "python", code: "", universe: ["SPY"], params: {} } as never)).toBeGreaterThanOrEqual(730);
  });
});

describe("Lab defaults", () => {
  it("opens a first-time visitor on a no-code strategy, not a code lesson", async () => {
    const { startNoCode } = await import("@/lib/lab/lab-form");
    const form = startNoCode();
    expect(form.mode).toBe("no-code");
    expect(form.lessonId).toBeNull();
  });

  it("passes the cash interest rate to the engine as a fraction", async () => {
    const { startNoCode, toRequest } = await import("@/lib/lab/lab-form");
    const built = toRequest({ ...startNoCode(), cashRate: 3.5 });
    if (!("request" in built)) throw new Error(built.errors.join(", "));
    expect(built.request.config.cashRate).toBeCloseTo(0.035, 10);
    expect("errors" in toRequest({ ...startNoCode(), cashRate: -1 })).toBe(true);
  });
});
