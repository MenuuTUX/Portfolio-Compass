import { describe, it, expect } from "bun:test";
import { createRandom } from "@/lib/monte-carlo";
import {
  hasAdjustedHistory,
  hasDailyHistory,
  historyProblemMessage,
  presentResult,
  runMode,
  type PreparedInputs,
  type RunSettings,
} from "@/lib/monte-carlo-run";

function dailyHistory(days: number, adjusted: boolean) {
  const start = Date.UTC(2024, 0, 1);
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    price: 100 + i,
    ...(adjusted ? { adjPrice: 100 + i } : {}),
  }));
}

const settings: RunSettings = {
  years: 2,
  drawnPaths: 5,
  statsPaths: 40,
  blockDays: 1,
  initial: 10_000,
  returnModel: "past",
  longRunPercent: 7,
  monthlyContribution: 0,
};

function inputs(overrides: Partial<PreparedInputs> = {}): PreparedInputs {
  const random = createRandom(7);
  const rows = [0, 1].map(() => Array.from({ length: 252 }, () => 0.0004 + (random() - 0.5) * 0.02));
  return {
    returns: rows,
    currentPrices: [100, 50],
    weights: [0.5, 0.5],
    seed: 11,
    periodsPerYear: 252,
    covarianceOk: true,
    settings,
    ...overrides,
  };
}

describe("history checks", () => {
  it("needs 200 points with no gap longer than a week", () => {
    expect(hasDailyHistory([])).toBe(false);
    expect(hasDailyHistory(dailyHistory(199, true))).toBe(false);
    expect(hasDailyHistory(dailyHistory(200, true))).toBe(true);
    const gapped = dailyHistory(250, true).filter((_, i) => i < 100 || i > 110);
    expect(hasDailyHistory(gapped)).toBe(false);
  });

  it("flags history stored before adjusted closes were fetched", () => {
    expect(hasAdjustedHistory(dailyHistory(250, true))).toBe(true);
    expect(hasAdjustedHistory(dailyHistory(250, false))).toBe(false);
    expect(hasAdjustedHistory([])).toBe(false);
  });

  it("words each history problem", () => {
    expect(historyProblemMessage({ ok: false, reason: "gap", ticker: "AAA", gapDays: 12 } as never)).toBe(
      "AAA has a gap of 12 days in its price history.",
    );
    expect(historyProblemMessage({ ok: false, reason: "short", ticker: "BBB", found: 90, needed: 200 } as never)).toBe(
      "BBB has only 90 daily returns; the simulator needs 200.",
    );
  });
});

describe("runMode", () => {
  it("is repeatable for a seed and returns the settings it ran with", async () => {
    const a = await runMode("resample", inputs());
    const b = await runMode("resample", inputs());
    if (!("summary" in a) || !("summary" in b)) throw new Error("expected a result");
    expect(a.summary.p50).toBe(b.summary.p50);
    expect(a.settings).toBe(settings);
    expect(a.drawn.paths).toHaveLength(settings.drawnPaths);
    expect(a.finals).toHaveLength(settings.statsPaths);
  });

  it("reports Randomize unavailable when the covariance cannot be factored", async () => {
    const outcome = await runMode("randomize", inputs({ covarianceOk: false }));
    expect("unavailable" in outcome && outcome.unavailable).toContain("Randomize is unavailable");
  });

  it("still runs Reshuffle and Resample when Randomize is unavailable", async () => {
    const outcome = await runMode("reshuffle", inputs({ covarianceOk: false }));
    expect("summary" in outcome).toBe(true);
  });

  it("runs the horizon in observed periods per year", async () => {
    const outcome = await runMode("resample", inputs({ periodsPerYear: 12 }));
    if (!("summary" in outcome)) throw new Error("expected a result");
    expect(outcome.drawn.days.at(-1)).toBe(settings.years * 12);
  });

  it("records Randomize on the largest step that divides the horizon", async () => {
    // 2 years x 252 = 504 days: 45 does not divide it, 42 does. The stats run prefers 21.
    const outcome = await runMode("randomize", inputs());
    if (!("summary" in outcome)) throw new Error("expected a result");
    expect(outcome.drawn.days[1]).toBe(42);
    expect(outcome.band.days[1]).toBe(21);
  });

  it("adds the monthly contribution every 21 trading days", async () => {
    const flat = inputs({ returns: [Array(252).fill(0), Array(252).fill(0)], settings: { ...settings, monthlyContribution: 500 } });
    const outcome = await runMode("resample", flat);
    if (!("summary" in outcome)) throw new Error("expected a result");
    // 504 days / 21 = 24 monthly contributions on top of the starting 10,000.
    expect(outcome.finals[0]).toBeCloseTo(10_000 + 24 * 500, 6);
  });

  it("lets errors that are not covariance failures through", async () => {
    await expect(runMode("resample", inputs({ weights: [0.5] }))).rejects.toThrow();
  });
});

describe("presentResult", () => {
  it("expresses a result in today's money", async () => {
    const nominal = await runMode("resample", inputs());
    if (!("summary" in nominal)) throw new Error("expected a result");
    const rate = 0.03;
    const real = presentResult(nominal, rate);
    const factor = (1 + rate) ** settings.years;
    expect(real.summary.p50).toBeCloseTo(nominal.summary.p50 / factor, 6);
    expect(real.finals[0]).toBeCloseTo(nominal.finals[0] / factor, 6);
    expect(real.drawn.paths[0][0]).toBeCloseTo(nominal.drawn.paths[0][0], 6);
    expect(real.band.p50[real.band.p50.length - 1]).toBeLessThan(nominal.band.p50[nominal.band.p50.length - 1]);
  });

  it("recounts the chance of loss on the deflated endings", async () => {
    const nominal = await runMode("resample", inputs());
    if (!("summary" in nominal)) throw new Error("expected a result");
    const real = presentResult(nominal, 0.5);
    expect(real.summary.chanceOfLoss).toBeGreaterThanOrEqual(nominal.summary.chanceOfLoss);
    expect(real.summary.chanceOfLoss).toBe(
      real.finals.filter((v) => v < settings.initial * (1 - 1e-9)).length / real.finals.length,
    );
  });
});
