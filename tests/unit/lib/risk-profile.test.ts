import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
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
});
