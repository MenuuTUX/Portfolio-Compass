import type { Portfolio } from "@/types";
import {
  calculateCone,
  summarizeOutcomes,
  medianPathIndex,
  simulatePaths,
  MODE_SEED_OFFSET,
  type SimulationMode,
  type SimulationRun,
  type OutcomeSummary,
} from "@/lib/monte-carlo";
import { hasDailyObservationCoverage, selectReturnBasis, type diagnoseHistory } from "@/lib/math/history";

export interface FanBand {
  /** Trading day of each point. */
  days: number[];
  p10: number[];
  p50: number[];
  p90: number[];
}

/** Recorded-step candidates for Randomize, largest first. Each divides the horizon when possible. */
const STEP_CANDIDATES = [45, 42, 36, 30, 28, 21, 14, 7, 6, 5, 4, 3, 2, 1] as const;
const STATS_STEP_DAYS = 21;

export type ReturnModel = "past" | "long";

/** Settings captured when Run is pressed; every mode run in that session uses them. */
export interface RunSettings {
  years: number;
  drawnPaths: number;
  statsPaths: number;
  blockDays: number;
  initial: number;
  returnModel: ReturnModel;
  longRunPercent: number;
  monthlyContribution: number;
}

export interface PreparedInputs {
  returns: number[][];
  currentPrices: number[];
  weights: number[];
  seed: number;
  periodsPerYear: number;
  /** False when the covariance cannot be factored; Randomize is then unavailable. */
  covarianceOk: boolean;
  settings: RunSettings;
}

export interface ModeResult {
  mode: SimulationMode;
  drawn: SimulationRun;
  highlight: number[];
  band: FanBand;
  summary: OutcomeSummary;
  /** Ending values of the stats paths, in the same money as the summary. */
  finals: number[];
  periodsPerYear: number;
  settings: RunSettings;
}

export type ModeOutcome = ModeResult | { mode: SimulationMode; unavailable: string };

export function hasDailyHistory(points: Portfolio[0]["history"]): boolean {
  return !!points && points.length >= 200 &&
    hasDailyObservationCoverage(points.map((point) => point.date));
}

/** Stored history from before adjusted closes were fetched is refetched, so existing portfolios move to total return. */
export function hasAdjustedHistory(points: Portfolio[0]["history"]): boolean {
  return selectReturnBasis([points ?? []]) === "total";
}

/**
 * Randomize records whole steps only, so the step must divide the horizon and
 * any contribution interval. Uses `preferred` when it fits, else the largest candidate that fits.
 */
function randomizeStep(numDays: number, everyDays: number | undefined, preferred?: number): number {
  const fits = (step: number) => numDays % step === 0 && (everyDays === undefined || everyDays % step === 0);
  if (preferred !== undefined && fits(preferred)) return preferred;
  return STEP_CANDIDATES.find(fits) ?? 1;
}

/** Lets React paint and respond to input between chunks of simulation work. */
export const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Only a failure to factor the covariance matrix means Randomize's correlations are unusable. */
function isCovarianceError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return /positive definite|non-finite values|Cholesky|covariance/i.test(message);
}

export function historyProblemMessage(problem: Extract<ReturnType<typeof diagnoseHistory>, { ok: false }>): string {
  if (problem.reason === "gap") {
    return `${problem.ticker} has a gap of ${problem.gapDays} days in its price history.`;
  }
  return `${problem.ticker} has only ${problem.found} daily returns; the simulator needs ${problem.needed}.`;
}

const RANDOMIZE_UNAVAILABLE = "Randomize is unavailable: historical covariance is not positive definite, so correlations cannot be modeled reliably. Reshuffle and Resample do not need it.";

/** Runs one mode on prepared inputs. Yields once between the drawn run and the stats run. */
export async function runMode(mode: SimulationMode, inputs: PreparedInputs): Promise<ModeOutcome> {
  const { returns, currentPrices, weights, seed, settings, periodsPerYear } = inputs;
  if (mode === "randomize" && !inputs.covarianceOk) return { mode, unavailable: RANDOMIZE_UNAVAILABLE };
  const numDays = settings.years * periodsPerYear;
  const base = (seed + MODE_SEED_OFFSET[mode]) | 0;
  const contribution = settings.monthlyContribution > 0
    ? { amount: settings.monthlyContribution, everyDays: Math.max(1, Math.round(periodsPerYear / 12)) }
    : undefined;
  const common = { returns, currentPrices, weights, initialValue: settings.initial, numDays, contribution };
  // Randomize records whole steps only; Reshuffle and Resample can end on a partial step.
  const everyDays = contribution?.everyDays;
  const drawnStep = mode === "randomize" ? randomizeStep(numDays, everyDays) : undefined;
  const statsStep = mode === "randomize" ? randomizeStep(numDays, everyDays, STATS_STEP_DAYS) : STATS_STEP_DAYS;
  try {
    const drawn = simulatePaths(mode, {
      ...common, numPaths: settings.drawnPaths, seed: base, blockDays: settings.blockDays, stepDays: drawnStep,
    });
    await yieldToBrowser();
    const stats = simulatePaths(mode, {
      ...common, numPaths: settings.statsPaths, stepDays: statsStep, seed: (base + 1) | 0, blockDays: settings.blockDays,
    });
    const cone = calculateCone(stats.paths);
    return {
      mode,
      drawn,
      highlight: drawn.referencePath ?? drawn.paths[medianPathIndex(drawn.paths)] ?? [],
      band: { days: stats.days, p10: cone.p10, p50: cone.median, p90: cone.p90 },
      summary: summarizeOutcomes(stats.paths, settings.initial),
      finals: stats.paths.map((p) => p[p.length - 1]),
      periodsPerYear,
      settings,
    };
  } catch (e) {
    if (mode === "randomize" && isCovarianceError(e)) {
      return { mode, unavailable: RANDOMIZE_UNAVAILABLE };
    }
    throw e;
  }
}

/**
 * The same result expressed in today's money: every value is divided by the
 * inflation accumulated up to its date. Chance of loss is recounted on the
 * deflated endings so it compares like with like against the starting value.
 */
export function presentResult(r: ModeResult, rate: number): ModeResult {
  const ppy = r.periodsPerYear;
  const factor = (1 + rate) ** r.settings.years;
  const deflateAt = (values: number[], days: number[]) =>
    values.map((v, k) => v / (1 + rate) ** (days[k] / ppy));
  const finals = r.finals.map((f) => f / factor);
  const below = r.settings.initial * (1 - 1e-9);
  const s = r.summary;
  return {
    ...r,
    drawn: { ...r.drawn, paths: r.drawn.paths.map((p) => deflateAt(p, r.drawn.days)) },
    highlight: deflateAt(r.highlight, r.drawn.days),
    band: {
      days: r.band.days,
      p10: deflateAt(r.band.p10, r.band.days),
      p50: deflateAt(r.band.p50, r.band.days),
      p90: deflateAt(r.band.p90, r.band.days),
    },
    summary: {
      ...s,
      p05: s.p05 / factor, p10: s.p10 / factor, p25: s.p25 / factor, p50: s.p50 / factor,
      p75: s.p75 / factor, p90: s.p90 / factor, p95: s.p95 / factor,
      chanceOfLoss: finals.filter((v) => v < below).length / Math.max(1, finals.length),
    },
    finals,
  };
}

