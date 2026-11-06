import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  horizonYearsFromAge,
  isAgeBand,
  isValidAmount,
  loadRiskProfile,
  portfolioAfterQuiz,
  saveRiskProfile,
  scoreRiskProfile,
} from "@/lib/risk-profile";

// Option values as the quiz defines them (0-100 per answer).
const base = { horizon: 100, ouch_test: 100, knowledge: 100, liquidity: 100, goal: 100 };

describe("scoreRiskProfile", () => {
  it("lets strong answers reach Growth only when nothing limits the investor", () => {
    expect(scoreRiskProfile(base).profile).toBe("Growth");
  });

  it("does not let other answers cancel a short horizon", () => {
    const r = scoreRiskProfile({ ...base, horizon: 0 });
    expect(r.profile).toBe("Conservative");
    expect(r.why.join(" ")).toMatch(/within 2 years/i);
  });

  it("does not let other answers cancel selling everything in a crash", () => {
    expect(scoreRiskProfile({ ...base, ouch_test: 0 }).profile).toBe("Conservative");
  });

  it("caps a 2 to 5 year horizon and thin emergency savings at Balanced", () => {
    expect(scoreRiskProfile({ ...base, horizon: 40 }).profile).toBe("Balanced");
    expect(scoreRiskProfile({ ...base, liquidity: 40 }).profile).toBe("Balanced");
  });

  it("uses the lower of comfort with loss and ability to take loss", () => {
    const r = scoreRiskProfile({ ...base, ouch_test: 30, goal: 50 });
    expect(r.score).toBe(Math.round(r.tolerance));
    expect(r.tolerance).toBeLessThan(r.capacity);
  });

  it("keeps experience from moving a result between Balanced and Growth on its own", () => {
    const answers = { horizon: 100, ouch_test: 60, liquidity: 80, goal: 50 };
    const a = scoreRiskProfile({ ...answers, knowledge: 70 });
    const b = scoreRiskProfile({ ...answers, knowledge: 100 });
    expect(a.profile).toBe(b.profile);
  });

  it("only uses experience to stop a beginner landing in Growth", () => {
    const r = scoreRiskProfile({ ...base, knowledge: 10 });
    expect(r.profile).toBe("Balanced");
    expect(r.why.join(" ")).toMatch(/beginner/i);
  });

  it("treats missing answers as the cautious choice", () => {
    expect(scoreRiskProfile({}).profile).toBe("Conservative");
  });
});

describe("score bands", () => {
  // With every input at x, comfort and capacity both equal x, and no cap
  // applies between 39 and 76, so the score is exactly x.
  const at = (x: number) => scoreRiskProfile({ horizon: x, ouch_test: x, knowledge: 100, liquidity: x, goal: x });

  it("puts 39 in Conservative, the last point under 40", () => {
    expect(at(39).score).toBe(39);
    expect(at(39).profile).toBe("Conservative");
  });

  it("puts 40 in Balanced, the first point of the middle band", () => {
    expect(at(40).score).toBe(40);
    expect(at(40).profile).toBe("Balanced");
  });

  it("keeps 75 in Balanced, the last point of the middle band", () => {
    expect(at(75).score).toBe(75);
    expect(at(75).profile).toBe("Balanced");
  });

  it("puts 76 in Growth, the first point above 75", () => {
    expect(at(76).score).toBe(76);
    expect(at(76).profile).toBe("Growth");
  });
});

describe("portfolioAfterQuiz", () => {
  const suggested = [{ ticker: "VTI", weight: 100, shares: 0 }];

  it("never replaces holdings the user already has", () => {
    expect(portfolioAfterQuiz([{ ticker: "XIC.TO", weight: 100, shares: 5 }], suggested)).toBeNull();
  });

  it("loads the example into an empty portfolio", () => {
    expect(portfolioAfterQuiz([], suggested)).toEqual(suggested);
  });

  it("does nothing when there is no example", () => {
    expect(portfolioAfterQuiz([], [])).toBeNull();
  });
});

describe("stored risk profile", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("round-trips", () => {
    saveRiskProfile({ profile: "Growth", score: 82 });
    const loaded = loadRiskProfile();
    expect(loaded?.profile).toBe("Growth");
    expect(loaded?.score).toBe(82);
    expect(typeof loaded?.takenAt).toBe("string");
  });

  it("ignores corrupt or unknown values", () => {
    localStorage.setItem("compass_risk_profile_v1", "{not json");
    expect(loadRiskProfile()).toBeNull();
    localStorage.setItem("compass_risk_profile_v1", JSON.stringify({ profile: "YOLO", score: 1 }));
    expect(loadRiskProfile()).toBeNull();
  });

  it("stores and returns the optional age, goal and monthly answers", () => {
    saveRiskProfile({ profile: "Balanced", score: 55, ageBand: "30-44", goalAmount: 250000, monthlyContribution: 800 });
    const loaded = loadRiskProfile();
    expect(loaded?.ageBand).toBe("30-44");
    expect(loaded?.goalAmount).toBe(250000);
    expect(loaded?.monthlyContribution).toBe(800);
  });

  it("keeps the quiz's optional answers when a later save leaves them out", () => {
    saveRiskProfile({ profile: "Balanced", score: 55, ageBand: "45-59", goalAmount: 0, monthlyContribution: 300 });
    saveRiskProfile({ profile: "Growth", score: 80 });
    const loaded = loadRiskProfile();
    expect(loaded?.profile).toBe("Growth");
    expect(loaded?.ageBand).toBe("45-59");
    expect(loaded?.goalAmount).toBe(0);
    expect(loaded?.monthlyContribution).toBe(300);
  });

  it("clears an optional answer when it is passed as undefined", () => {
    saveRiskProfile({ profile: "Balanced", score: 55, goalAmount: 10000 });
    saveRiskProfile({ profile: "Balanced", score: 55, goalAmount: undefined });
    expect(loadRiskProfile()?.goalAmount).toBeUndefined();
  });

  it("drops invalid optional answers on load and keeps the profile", () => {
    localStorage.setItem(
      "compass_risk_profile_v1",
      JSON.stringify({
        profile: "Conservative",
        score: 20,
        takenAt: "2026-01-01T00:00:00.000Z",
        ageBand: "teen",
        goalAmount: -5,
        monthlyContribution: "100",
      }),
    );
    const loaded = loadRiskProfile();
    expect(loaded?.profile).toBe("Conservative");
    expect(loaded?.ageBand).toBeUndefined();
    expect(loaded?.goalAmount).toBeUndefined();
    expect(loaded?.monthlyContribution).toBeUndefined();
  });

  it("drops an amount at or above one trillion on load", () => {
    localStorage.setItem(
      "compass_risk_profile_v1",
      JSON.stringify({ profile: "Growth", score: 90, takenAt: "", goalAmount: 1e12, monthlyContribution: 1e12 }),
    );
    expect(loadRiskProfile()?.goalAmount).toBeUndefined();
    expect(loadRiskProfile()?.monthlyContribution).toBeUndefined();
  });
});

describe("optional quiz answers", () => {
  it("accepts only the four age bands", () => {
    expect(isAgeBand("under-30")).toBe(true);
    expect(isAgeBand("60-plus")).toBe(true);
    expect(isAgeBand("60")).toBe(false);
    expect(isAgeBand(undefined)).toBe(false);
  });

  it("accepts finite amounts from 0 up to but not including one trillion", () => {
    expect(isValidAmount(0)).toBe(true);
    expect(isValidAmount(999_999_999_999)).toBe(true);
    expect(isValidAmount(-1)).toBe(false);
    expect(isValidAmount(1e12)).toBe(false);
    expect(isValidAmount(Number.NaN)).toBe(false);
    expect(isValidAmount(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidAmount("100")).toBe(false);
  });

  it("maps each age band to years to 65 from its midpoint, kept between 5 and 30", () => {
    expect(horizonYearsFromAge("under-30")).toBe(30);
    expect(horizonYearsFromAge("30-44")).toBe(28);
    expect(horizonYearsFromAge("45-59")).toBe(13);
    expect(horizonYearsFromAge("60-plus")).toBe(5);
  });
});
