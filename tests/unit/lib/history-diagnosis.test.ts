import { describe, expect, it } from "bun:test";
import type { Portfolio, PortfolioItem } from "@/types";
import { observationsPerYear, tickersWithoutAdjustedHistory, diagnoseHistory } from "@/lib/math/history";

const DAY = 86_400_000;
const START = Date.parse("2024-01-01");

/** Consecutive daily points; `adjEvery` leaves adjPrice off all but every n-th point. */
const dailyHistory = (count: number, { adjEvery = 1, gapAfter, gapDays = 0 }: {
  adjEvery?: number; gapAfter?: number; gapDays?: number;
} = {}) => {
  const points: { date: string; price: number; adjPrice?: number }[] = [];
  let time = START;
  for (let i = 0; i < count; i++) {
    const point: { date: string; price: number; adjPrice?: number } = {
      date: new Date(time).toISOString().slice(0, 10),
      price: 100 + i,
    };
    if (i % adjEvery === 0) point.adjPrice = 100 + i;
    points.push(point);
    time += (i === gapAfter ? gapDays + 1 : 1) * DAY;
  }
  return points;
};

const holding = (ticker: string, shares: number, history: ReturnType<typeof dailyHistory>) =>
  ({ ticker, name: ticker, price: 100, changePercent: 0, shares, weight: 0, history, metrics: {}, allocation: {} }) as unknown as PortfolioItem;

describe("observationsPerYear", () => {
  it("counts observations per calendar year without snapping to 252", () => {
    const dates = dailyHistory(730).map((p) => p.date);
    // 730 points span 729 days.
    expect(observationsPerYear(dates)).toBeCloseTo(729 / (729 / 365.25), 9);
    expect(observationsPerYear(dates)).not.toBe(252);
  });

  it("falls back to 252 with fewer than three dates", () => {
    expect(observationsPerYear([])).toBe(252);
    expect(observationsPerYear(["2024-01-01", "2024-01-02"])).toBe(252);
  });
});

describe("tickersWithoutAdjustedHistory", () => {
  it("lists held holdings that lack adjusted closes on 5% or more of points", () => {
    const portfolio: Portfolio = [
      holding("FULL", 10, dailyHistory(30)),
      holding("HALF", 10, dailyHistory(30, { adjEvery: 2 })),
      holding("UNHELD", 0, dailyHistory(30, { adjEvery: 2 })),
      holding("EMPTY", 5, []),
    ];
    expect(tickersWithoutAdjustedHistory(portfolio)).toEqual(["HALF", "EMPTY"]);
  });
});

describe("diagnoseHistory", () => {
  it("passes when every held holding has enough contiguous history", () => {
    const portfolio: Portfolio = [holding("A", 1, dailyHistory(300))];
    expect(diagnoseHistory(portfolio)).toEqual({ ok: true });
  });

  it("names the holding that is too short and how many returns it has", () => {
    const portfolio: Portfolio = [
      holding("A", 1, dailyHistory(300)),
      holding("SHORT", 1, dailyHistory(101)),
    ];
    expect(diagnoseHistory(portfolio)).toEqual({
      ok: false,
      reason: "too-short",
      ticker: "SHORT",
      found: 100,
      needed: 200,
    });
  });

  it("names the holding with a gap and reports the gap length", () => {
    const portfolio: Portfolio = [holding("GAPPY", 1, dailyHistory(300, { gapAfter: 150, gapDays: 10 }))];
    const result = diagnoseHistory(portfolio);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("gap");
      expect(result.ticker).toBe("GAPPY");
      expect(result.gapDays).toBe(11);
    }
  });

  it("reports the shortest history first", () => {
    const portfolio: Portfolio = [
      holding("MID", 1, dailyHistory(150)),
      holding("TINY", 1, dailyHistory(50)),
    ];
    const result = diagnoseHistory(portfolio);
    expect(!result.ok && result.ticker).toBe("TINY");
  });

  it("ignores holdings that are not held", () => {
    const portfolio: Portfolio = [holding("SOLD", 0, dailyHistory(10))];
    expect(diagnoseHistory(portfolio)).toEqual({ ok: true });
  });
});
