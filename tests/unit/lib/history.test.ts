import { describe, expect, it } from "bun:test";
import { hasDailyObservationCoverage } from "@/lib/math/history";

describe("hasDailyObservationCoverage", () => {
  it("rejects a large gap anywhere in the observed lookback", () => {
    expect(
      hasDailyObservationCoverage([
        "2025-01-01",
        "2025-01-02",
        "2025-03-01",
        "2025-03-02",
      ]),
    ).toBe(false);
  });

  it("rejects invalid or unordered observations", () => {
    expect(hasDailyObservationCoverage(["2025-01-02", "not-a-date"])).toBe(false);
    expect(hasDailyObservationCoverage(["2025-01-02", "2025-01-01"])).toBe(false);
  });

  it("allows ordinary weekends and holiday gaps", () => {
    expect(
      hasDailyObservationCoverage([
        "2025-01-03",
        "2025-01-06",
        "2025-01-07",
        "2025-01-10",
      ]),
    ).toBe(true);
  });
});
