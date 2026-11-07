import { describe, expect, it } from "bun:test";
import { isShortRun, rebaseToCommonStart, runDays, SHORT_RUN } from "@/components/lab/format";

describe("short runs", () => {
  it("counts calendar days between the first and last date", () => {
    expect(runDays("2024-01-01", "2024-01-31")).toBe(30);
    expect(runDays("2020-01-01", "2021-01-01")).toBe(366);
  });

  it("treats anything under 365 days as too short to annualize", () => {
    expect(isShortRun("2024-01-01", "2024-01-31")).toBe(true);
    expect(isShortRun("2024-01-01", "2024-12-30")).toBe(true);
    expect(isShortRun("2024-01-01", "2025-01-01")).toBe(false);
    expect(SHORT_RUN).toBe("n/a (under 1 year)");
  });
});

describe("rebaseToCommonStart", () => {
  it("rebases runs with different start dates to 1 at the latest common start", () => {
    const early = { dates: ["2020-01-01", "2020-01-02", "2020-01-03"], growth: [1, 1.1, 1.21] };
    const late = { dates: ["2020-01-02", "2020-01-03"], growth: [1, 2] };
    const out = rebaseToCommonStart([early, late]);
    expect(out.start).toBe("2020-01-02");
    expect(out.dates).toEqual(["2020-01-02", "2020-01-03"]);
    expect(out.values[0]![0]).toBeCloseTo(1, 12);
    expect(out.values[0]![1]).toBeCloseTo(1.21 / 1.1, 12);
    expect(out.values[1]).toEqual([1, 2]);
  });

  it("rebases each run at its first bar on or after the common start, and gaps stay empty", () => {
    const a = { dates: ["2020-01-01", "2020-01-03", "2020-01-06"], growth: [1, 1.5, 3] };
    const b = { dates: ["2020-01-02", "2020-01-06"], growth: [1, 4] };
    const out = rebaseToCommonStart([a, b]);
    expect(out.start).toBe("2020-01-02");
    expect(out.dates).toEqual(["2020-01-02", "2020-01-03", "2020-01-06"]);
    expect(out.values[0]).toEqual([NaN, 1, 2]);
    expect(out.values[1]).toEqual([1, NaN, 4]);
  });

  it("leaves runs with the same start as they were", () => {
    const a = { dates: ["2020-01-01", "2020-01-02"], growth: [1, 1.05] };
    const b = { dates: ["2020-01-01", "2020-01-02"], growth: [1, 0.9] };
    const out = rebaseToCommonStart([a, b]);
    expect(out.start).toBe("2020-01-01");
    expect(out.values).toEqual([[1, 1.05], [1, 0.9]]);
  });

  it("drops a run that has no point on or after the common start", () => {
    const old = { dates: ["2010-01-01", "2010-06-01"], growth: [1, 1.2] };
    const newer = { dates: ["2015-01-01", "2016-01-01"], growth: [1, 1.3] };
    const out = rebaseToCommonStart([old, newer]);
    expect(out.values[0]).toBeNull();
    expect(out.values[1]).toEqual([1, 1.3]);
  });

  it("returns nothing for no runs", () => {
    expect(rebaseToCommonStart([])).toEqual({ start: null, dates: [], values: [] });
  });
});
