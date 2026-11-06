import { describe, expect, it } from "bun:test";
import { WEIGHT_SUM_TOLERANCE } from "@/lib/lab/engine/simulate";
import { normalizeWeights } from "@/lib/lab/strategy/weights";
import { HARNESS_PY } from "@/lib/lab/strategy/python";
import type { PriceMatrix } from "@/lib/lab/strategy/types";

const prices: PriceMatrix = {
  dates: ["2024-01-02", "2024-01-03"],
  tickers: ["AAA", "BBB"],
  adjClose: new Float64Array(4).fill(1),
};

describe("weight sum tolerance", () => {
  it("is one part in a million, shared by the engine and both strategy languages", () => {
    expect(WEIGHT_SUM_TOLERANCE).toBe(1e-6);
    expect(HARNESS_PY).toContain(`_LAB_MAX_TOTAL = ${1 + WEIGHT_SUM_TOLERANCE}`);
  });

  it("accepts totals within the tolerance, such as float rounding", () => {
    const w = normalizeWeights([[0.5 + 1e-7, 0.5], [0.3, 0.7]], prices);
    expect([...w]).toEqual([0.5 + 1e-7, 0.5, 0.3, 0.7]);
  });

  it("rejects a total above 1 with the day it happens and the total", () => {
    expect(() => normalizeWeights([[0.6, 0.5], [0.3, 0.3]], prices)).toThrow(/2024-01-02.*1\.1/);
  });

  it("names the day in the Python message too", () => {
    expect(HARNESS_PY).toContain("Your weights on {day} add up to");
  });

  it("gives a clear message for a day with a total just above the tolerance", () => {
    expect(() => normalizeWeights([[0.5, 0.5 + 2 * WEIGHT_SUM_TOLERANCE], [0, 0]], prices)).toThrow(/must total 1 or less/);
  });
});
