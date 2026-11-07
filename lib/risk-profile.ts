import type { LocalPortfolioItem } from "@/lib/storage";

export type RiskProfile = "Conservative" | "Balanced" | "Growth";

/** Each answer is the 0-100 value of the option the user picked. */
export type QuizAnswers = Partial<
  Record<"horizon" | "ouch_test" | "knowledge" | "liquidity" | "goal", number>
>;

export interface ProfileScore {
  score: number;
  profile: RiskProfile;
  /** How much loss the person says they can sit through (0-100). */
  tolerance: number;
  /** How much loss their situation can absorb (0-100). */
  capacity: number;
  /** Plain-language reasons, shown on the result. */
  why: string[];
}

const CONSERVATIVE_BELOW = 40;
const GROWTH_ABOVE = 75;
// One step under the Growth threshold: a cap that lands here means "Balanced".
const BALANCED_CAP = 70;
const CONSERVATIVE_CAP = 35;

/**
 * Risk profile from the five quiz answers.
 *
 * Comfort with loss and ability to take loss are scored separately and the
 * lower one decides, so enthusiasm cannot cancel a short horizon or no
 * emergency savings. Experience never adds risk; it only stops a beginner
 * landing in Growth.
 */
export function scoreRiskProfile(answers: QuizAnswers): ProfileScore {
  const a = {
    horizon: answers.horizon ?? 0,
    ouch_test: answers.ouch_test ?? 0,
    knowledge: answers.knowledge ?? 0,
    liquidity: answers.liquidity ?? 0,
    goal: answers.goal ?? 0,
  };

  const tolerance = 0.7 * a.ouch_test + 0.3 * a.goal;
  const capacity = 0.5 * a.horizon + 0.5 * a.liquidity;
  let score = Math.min(tolerance, capacity);

  const why = [
    `Comfort with loss: ${Math.round(tolerance)} of 100. Ability to take loss: ${Math.round(capacity)} of 100. The lower one sets the level.`,
  ];
  const cap = (max: number, reason: string) => {
    if (score > max) {
      score = max;
      why.push(reason);
    }
  };

  if (a.horizon <= 0) cap(CONSERVATIVE_CAP, "You may need this money within 2 years, so it stays Conservative.");
  else if (a.horizon <= 40) cap(BALANCED_CAP, "You may need this money within 5 years, so it is held at Balanced.");
  if (a.liquidity <= 40) cap(BALANCED_CAP, "Little emergency cash outside this portfolio holds the result at Balanced.");
  if (a.knowledge <= 10) cap(BALANCED_CAP, "As a beginner, Growth is held back until you have more experience.");

  const rounded = Math.round(score);
  const profile: RiskProfile =
    rounded < CONSERVATIVE_BELOW ? "Conservative" : rounded > GROWTH_ABOVE ? "Growth" : "Balanced";

  return { score: rounded, profile, tolerance, capacity, why };
}

/**
 * Holdings to save after the quiz, or null to leave storage untouched. The
 * example only ever fills an empty portfolio; it never replaces real holdings.
 */
export function portfolioAfterQuiz(
  existing: LocalPortfolioItem[],
  suggested: LocalPortfolioItem[],
): LocalPortfolioItem[] | null {
  if (existing.length > 0 || suggested.length === 0) return null;
  return suggested;
}

const PROFILE_KEY = "compass_risk_profile_v1";
const PROFILES: readonly RiskProfile[] = ["Conservative", "Balanced", "Growth"];

export type AgeBand = "under-30" | "30-44" | "45-59" | "60-plus";
const AGE_BANDS: readonly AgeBand[] = ["under-30", "30-44", "45-59", "60-plus"];

export function isAgeBand(value: unknown): value is AgeBand {
  return AGE_BANDS.includes(value as AgeBand);
}

const MAX_AMOUNT = 1_000_000_000_000;

/** A finite amount from 0 up to, not including, one trillion. */
export function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < MAX_AMOUNT;
}

// Each band's midpoint age; the years to 65 are kept inside the projector's 5 to 30 range.
const BAND_MIDPOINT_AGE: Record<AgeBand, number> = { "under-30": 25, "30-44": 37, "45-59": 52, "60-plus": 67 };

/** Time horizon in years to age 65, from the age band's midpoint. */
export function horizonYearsFromAge(band: AgeBand): number {
  return Math.min(30, Math.max(5, 65 - BAND_MIDPOINT_AGE[band]));
}

/** Optional answers from the quiz. None of them affect the score. */
export interface OptionalRiskAnswers {
  ageBand?: AgeBand;
  /** Savings goal in the chosen currency. */
  goalAmount?: number;
  /** Amount the user could add each month, in the chosen currency. */
  monthlyContribution?: number;
}

export interface StoredRiskProfile extends OptionalRiskAnswers {
  profile: RiskProfile;
  score: number;
  takenAt: string;
}

/**
 * Save the quiz result. A key left out of the call keeps the stored answer,
 * so the page's later save does not erase the quiz's optional answers. A key
 * passed as undefined clears that answer, so a retake without a goal drops the old one.
 */
export function saveRiskProfile(value: { profile: RiskProfile; score: number } & OptionalRiskAnswers): void {
  if (!globalThis.window) return;
  try {
    const existing = loadRiskProfile();
    const ageBand = "ageBand" in value ? value.ageBand : existing?.ageBand;
    const goalAmount = "goalAmount" in value ? value.goalAmount : existing?.goalAmount;
    const monthlyContribution =
      "monthlyContribution" in value ? value.monthlyContribution : existing?.monthlyContribution;

    const stored: StoredRiskProfile = {
      profile: value.profile,
      score: value.score,
      takenAt: new Date().toISOString(),
    };
    if (ageBand !== undefined) stored.ageBand = ageBand;
    if (goalAmount !== undefined) stored.goalAmount = goalAmount;
    if (monthlyContribution !== undefined) stored.monthlyContribution = monthlyContribution;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(stored));
  } catch {
    // Private mode or full storage: the quiz result is a convenience, not data.
  }
}

export function loadRiskProfile(): StoredRiskProfile | null {
  if (!globalThis.window) return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRiskProfile>;
    if (!PROFILES.includes(parsed.profile as RiskProfile)) return null;
    if (typeof parsed.score !== "number" || !Number.isFinite(parsed.score)) return null;
    const stored: StoredRiskProfile = {
      profile: parsed.profile as RiskProfile,
      score: parsed.score,
      takenAt: typeof parsed.takenAt === "string" ? parsed.takenAt : "",
    };
    // Invalid optional answers are dropped; the profile itself still loads.
    if (isAgeBand(parsed.ageBand)) stored.ageBand = parsed.ageBand;
    if (isValidAmount(parsed.goalAmount)) stored.goalAmount = parsed.goalAmount;
    if (isValidAmount(parsed.monthlyContribution)) stored.monthlyContribution = parsed.monthlyContribution;
    return stored;
  } catch {
    return null;
  }
}
