import { describe, expect, it } from "bun:test";
import type { BarSeries } from "@/lib/lab/bar-types";
import { buildFrame } from "@/lib/lab/engine/frame";
import { compileStrategy, type NoCodeStrategy } from "@/lib/lab/no-code";
import { sma, topN } from "@/lib/lab/strategy/indicators";
import { CODE_TEMPLATES, noCodeToSource } from "@/lib/lab/strategy/templates";
import { computeTsWeights, loadTypeScript, locateError } from "@/lib/lab/strategy/ts-runner";
import type { PriceMatrix } from "@/lib/lab/strategy/types";
import { checkLookahead, normalizeWeights } from "@/lib/lab/strategy/weights";
import recorded from "@/tests/fixtures/lab-spy-agg-2023-2024.json";

const data = recorded as BarSeries[];
const frame = buildFrame(data, { baseCurrency: "USD" });
const prices: PriceMatrix = { dates: frame.dates, tickers: frame.tickers, adjClose: frame.adjClose };

const run = (code: string, p: PriceMatrix = prices, params = {}) => {
  const sink = { lines: [] as string[] };
  const mod = loadTypeScript(code, sink);
  return { weights: computeTsWeights(mod, p, params), logs: sink.lines, params: mod.params };
};

describe("View as code (TypeScript)", () => {
  const rules: NoCodeStrategy[] = [
    { kind: "fixed", allocation: { SPY: 0.6, AGG: 0.4 } },
    { kind: "trend", allocation: { SPY: 0.7, AGG: 0.3 }, smaDays: 50, safe: "AGG" },
    { kind: "trend", allocation: { SPY: 1 }, smaDays: 20 },
    { kind: "momentum", universe: ["SPY", "AGG"], lookbackDays: 63, top: 1, absolute: true },
  ];
  for (const rule of rules) {
    it(`generates code that matches the ${rule.kind} rule exactly${"safe" in rule && rule.safe ? " with a safe asset" : ""}`, () => {
      const expected = compileStrategy(frame, rule);
      const { weights } = run(noCodeToSource(rule, "typescript"));
      expect([...weights]).toEqual([...expected]);
    });
  }
});

describe("TypeScript runner", () => {
  it("runs every built-in template on real data and reads its params", () => {
    for (const t of CODE_TEMPLATES) {
      // The fixture holds SPY and AGG, so the crossover's IEF stands in as AGG.
      const { weights, params } = run(t.typescript.replace(/"IEF"/g, '"AGG"'));
      expect(weights.length).toBe(prices.dates.length * 2);
      expect(Object.keys(params).length).toBeGreaterThan(0);
    }
  });

  it("captures console output", () => {
    const { logs } = run(`export function weights(p: Prices) { console.log("rows", p.length, { a: 1 }); return p.dates.map(() => ({ SPY: 1 })); }`);
    expect(logs).toEqual([`rows ${prices.dates.length} {"a":1}`]);
  });

  it("applies param overrides on top of the defaults", () => {
    const code = `export const params = { w: 0.5 };
export function weights(p: Prices, ctx: Context) { return p.dates.map(() => ({ SPY: Number(ctx.params.w) })); }`;
    expect(run(code).weights[0]).toBe(0.5);
    expect(run(code, prices, { w: 0.25 }).weights[0]).toBe(0.25);
  });

  it("points a syntax error at its line", () => {
    try {
      loadTypeScript("export const params = {};\n\nexport function weights(p) {\n  return p.dates.map(( => 1);\n}\n", { lines: [] });
      throw new Error("expected a syntax error");
    } catch (e) {
      expect(locateError(e).line).toBe(4);
    }
  });

  it("points a runtime error at its line", () => {
    const code = "export function weights(p: Prices) {\n  const x: any = undefined;\n  return x.boom;\n}\n";
    try {
      run(code);
      throw new Error("expected a runtime error");
    } catch (e) {
      expect(locateError(e)).toMatchObject({ line: 3 });
    }
  });

  it("refuses imports and explains why", () => {
    expect(() => run(`import x from "lodash";\nexport function weights() { return x; }`)).toThrow("Imports are not available");
  });

  it("rejects output of the wrong shape with a plain message", () => {
    expect(() => run(`export function weights() { return [[1]]; }`)).toThrow(/expected one per date/);
    expect(() => run(`export function weights(p: Prices) { return { QQQ: p.dates.map(() => 1) }; }`)).toThrow(/QQQ/);
  });
});

describe("lookahead check", () => {
  const compute = (code: string) => {
    const mod = loadTypeScript(code, { lines: [] });
    return (p: PriceMatrix) => computeTsWeights(mod, p, {});
  };

  it("passes a strategy that only looks back", async () => {
    const f = compute(noCodeToSource({ kind: "trend", allocation: { SPY: 1 }, smaDays: 50, safe: "AGG" }, "typescript"));
    const result = await checkLookahead(prices, f(prices), f);
    expect(result.leaks).toBe(false);
    expect(result.cutoffs).toHaveLength(2);
  });

  it("catches a strategy that reads tomorrow's price", async () => {
    const peek = `export function weights(p: Prices) {
  const spy = p.col("SPY");
  return p.dates.map((_, t) => (spy[t + 1] > spy[t] ? { SPY: 1 } : { AGG: 1 }));
}`;
    const f = compute(peek);
    const result = await checkLookahead(prices, f(prices), f);
    expect(result.leaks).toBe(true);
    expect(result.firstDate).toBeDefined();
  });

  it("catches a strategy that uses the whole-period average", async () => {
    const f = compute(`export function weights(p: Prices) {
  const spy = p.col("SPY");
  const mean = spy.reduce((a, b) => a + b, 0) / spy.length;
  return p.dates.map((_, t) => (spy[t] > mean ? { SPY: 1 } : { AGG: 1 }));
}`);
    expect((await checkLookahead(prices, f(prices), f)).leaks).toBe(true);
  });
});

describe("indicators and output shapes", () => {
  it("skips gaps in the moving average instead of resetting", () => {
    expect([...sma([1, 2, NaN, 3, 4], 2)]).toEqual([NaN, 1.5, NaN, 2.5, 3.5]);
  });

  it("equal-weights the top scores and ignores missing ones", () => {
    expect([...topN(Float64Array.from([3, 1, 2, NaN, 5, NaN]), 3, 2)]).toEqual([0.5, 0, 0.5, 0, 0.5, 0]);
  });

  it("accepts a flat matrix, rows, row objects and columns, with NaN as no position", () => {
    const p: PriceMatrix = { dates: ["a", "b"], tickers: ["X", "Y"], adjClose: new Float64Array(4) };
    const expected = [1, 0, 0.5, 0.5];
    expect([...normalizeWeights(Float64Array.from([1, NaN, 0.5, 0.5]), p)]).toEqual(expected);
    expect([...normalizeWeights([[1, 0], [0.5, 0.5]], p)]).toEqual(expected);
    expect([...normalizeWeights([{ X: 1 }, { X: 0.5, Y: 0.5 }], p)]).toEqual(expected);
    expect([...normalizeWeights({ X: [1, 0.5], Y: [0, 0.5] }, p)]).toEqual(expected);
  });
});
