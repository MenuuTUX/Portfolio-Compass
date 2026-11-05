"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import { Portfolio } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Play,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  calculateLogReturns,
  calculateCovarianceMatrix,
  getRegularizedCholesky,
  simulatePaths,
  calculateCone,
  summarizeOutcomes,
  returnHistogram,
  medianPathIndex,
  MODE_SEED_OFFSET,
  type SimulationMode,
  type SimulationRun,
  type OutcomeSummary,
  type HistogramBin,
} from "@/lib/monte-carlo";
import {
  getEffectiveWeights,
  getPortfolioMarketValue,
  getPortfolioCurrency,
} from "@/lib/math/portfolio-returns";
import {
  alignPriceHistories,
  selectReturnBasis,
  type ReturnBasis,
  hasDailyObservationCoverage,
} from "@/lib/math/history";
import { convertPriceHistoryToCad, type HistoricalFxRate } from "@/lib/math/fx-history";
import { getPortfolioValuation, type BankOfCanadaFxRate } from "@/lib/math/portfolio-returns";
import { GAIN, LOSS, MC_MODE_COLOR, MC_MODE_COLOR_ALT } from "@/lib/chart-colors";
import { PortfolioShareButton } from "../PortfolioShareButton";
import SimulatorExplainer from "./SimulatorExplainer";
import PathFan, { type FanBand } from "./PathFan";
import OutcomeHistogram from "./OutcomeHistogram";
import { signedPercent } from "./format";
import { EASE } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils";

const HORIZONS = [5, 10, 15, 20, 30] as const;
const PATH_COUNTS = [20, 50, 100] as const;
const STATS_PATH_OPTIONS = [1000, 2000, 5000] as const;
const BLOCK_OPTIONS = [
  { days: 1, label: "1 day" },
  { days: 5, label: "1 week" },
  { days: 21, label: "1 month" },
] as const;
/**
 * The drawn paths are few so they stay legible, but a 10th percentile from 20
 * paths is roughly the second-worst path. The bands and the risk figures come
 * from a separate, larger run recorded monthly (21 trading days).
 */
const DEFAULT_STATS_PATHS = 2000;
const STATS_STEP_DAYS = 21;
const TRADING_DAYS = 252;

const MODE_ORDER: SimulationMode[] = ["reshuffle", "resample", "randomize"];

const MODE_INFO: Record<SimulationMode, { name: string; line: string; method: string }> = {
  reshuffle: {
    name: "Reshuffle",
    line: "Same returns as the past year, in a different order. Every path ends in the same place; the ride there is what changes.",
    method: "Each path replays the past year's trading days in a random order, repeated once for every year of the horizon. Every holding's return from the same date stays together.",
  },
  resample: {
    name: "Resample",
    line: "Real past days picked at random, with repeats. Some paths get more good days, some more bad ones.",
    method: "Each simulated day is a real trading day from the past year, picked at random with repeats allowed. Every holding's return from the same date stays together.",
  },
  randomize: {
    name: "Randomize",
    line: "Returns drawn from a smooth curve fitted to the past year's average, swings and links between holdings.",
    method: "Each simulated step applies a random daily return using the historical average, volatility, and co-movement between holdings.",
  },
};

interface MonteCarloSimulatorProps {
  portfolio: Portfolio;
  baseCurrency?: string;
  startingValue?: number;
  fxProvenance?: BankOfCanadaFxRate;
  onBack?: () => void;
}

interface SimulationModelStats {
  /** Fraction of average variance added to the diagonal for near-duplicate holdings; 0 if none. */
  ridge: number;
  /** False when the covariance cannot be factored, which only rules out Randomize. */
  covarianceOk: boolean;
  annualizedLogDrift: number;
  annualizedVolatility: number;
  observationCount: number;
  lookbackStart: string;
  lookbackEnd: string;
  /** What the drift and volatility are computed from. */
  basis: ReturnBasis;
  /** Seed the paths were drawn with; reusing it reproduces them exactly. */
  seed: number;
}

/** Settings captured when Run is pressed; every mode run in that session uses them. */
interface RunSettings {
  years: number;
  drawnPaths: number;
  statsPaths: number;
  blockDays: number;
  initial: number;
}

interface PreparedInputs {
  returns: number[][];
  currentPrices: number[];
  weights: number[];
  seed: number;
  /** False when the covariance cannot be factored; Randomize is then unavailable. */
  covarianceOk: boolean;
  settings: RunSettings;
}

interface ModeResult {
  mode: SimulationMode;
  drawn: SimulationRun;
  highlight: number[];
  band: FanBand;
  summary: OutcomeSummary;
  histogram: HistogramBin[];
  daysPerYear: number;
  settings: RunSettings;
}

type ModeOutcome = ModeResult | { mode: SimulationMode; unavailable: string };

function hasDailyHistory(points: Portfolio[0]["history"]): boolean {
  return !!points && points.length >= 200 &&
    hasDailyObservationCoverage(points.map((point) => point.date));
}

/** Stored history from before adjusted closes were fetched is refetched, so existing portfolios move to total return. */
function hasAdjustedHistory(points: Portfolio[0]["history"]): boolean {
  return selectReturnBasis([points ?? []]) === "total";
}

/** Whole percent; a small but nonzero share reads "<1%" rather than a misleading 0%. */
const pct = (v: number) => (v > 0 && v < 0.005 ? "<1%" : `${Math.round(v * 100)}%`);

const RANDOMIZE_UNAVAILABLE = "Randomize is unavailable: historical covariance is not positive definite, so correlations cannot be modeled reliably. Reshuffle and Resample do not need it.";

/** Runs one mode on prepared inputs. Pure apart from the simulation itself. */
function runMode(mode: SimulationMode, inputs: PreparedInputs): ModeOutcome {
  const { returns, currentPrices, weights, seed, settings } = inputs;
  if (mode === "randomize" && !inputs.covarianceOk) return { mode, unavailable: RANDOMIZE_UNAVAILABLE };
  const T = returns[0].length;
  const daysPerYear = mode === "reshuffle" ? T : TRADING_DAYS;
  const numDays = settings.years * daysPerYear;
  const base = (seed + MODE_SEED_OFFSET[mode]) | 0;
  const common = { returns, currentPrices, weights, initialValue: settings.initial, numDays };
  try {
    const drawn = simulatePaths(mode, {
      ...common, numPaths: settings.drawnPaths, seed: base, blockDays: settings.blockDays,
    });
    const stats = simulatePaths(mode, {
      ...common, numPaths: settings.statsPaths, stepDays: STATS_STEP_DAYS, seed: (base + 1) | 0, blockDays: settings.blockDays,
    });
    const cone = calculateCone(stats.paths);
    const finals = stats.paths.map((p) => p[p.length - 1] / settings.initial - 1);
    return {
      mode,
      drawn,
      highlight: drawn.referencePath ?? drawn.paths[medianPathIndex(drawn.paths)] ?? [],
      band: { days: stats.days, p10: cone.p10, p50: cone.median, p90: cone.p90 },
      summary: summarizeOutcomes(stats.paths, settings.initial),
      histogram: returnHistogram(finals, 30),
      daysPerYear,
      settings,
    };
  } catch (e) {
    if (mode === "randomize") {
      return { mode, unavailable: RANDOMIZE_UNAVAILABLE };
    }
    throw e;
  }
}

export default function MonteCarloSimulator({
  portfolio,
  baseCurrency,
  startingValue,
  fxProvenance,
  onBack,
}: MonteCarloSimulatorProps) {
  const heldPortfolio = portfolio.filter((item) => item.shares > 0);
  const currency = baseCurrency ?? getPortfolioCurrency(portfolio) ?? undefined;
  const mixedCurrency = new Set(heldPortfolio.map((item) => item.currency)).size > 1;
  const currentPortfolioValue = useMemo(() => startingValue ??
    (mixedCurrency && currency ? getPortfolioValuation(portfolio, currency, Date.now(), fxProvenance).totalValue ?? NaN : getPortfolioMarketValue(portfolio)),
    [portfolio, startingValue, mixedCurrency, currency, fxProvenance]);

  // Setup
  const [mode, setMode] = useState<SimulationMode>("resample");
  const [compare, setCompare] = useState(false);
  const [numSimulations, setNumSimulations] = useState(50);
  const [timeHorizonYears, setTimeHorizonYears] = useState(10);
  const [statsPaths, setStatsPaths] = useState<number>(DEFAULT_STATS_PATHS);
  const [blockDays, setBlockDays] = useState(1);
  const [bandOverride, setBandOverride] = useState<boolean | null>(null);
  // Do not invent a balance when the portfolio value is unavailable.
  const [initialInvestment, setInitialInvestment] = useState<number>(
    Number.isFinite(currentPortfolioValue) ? currentPortfolioValue : 0,
  );
  const [reuseSeed, setReuseSeed] = useState(false);
  // Live quotes keep re-syncing the investment; only a typed change should ask for a re-run.
  const [investmentEdited, setInvestmentEdited] = useState(false);

  // Run state
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [modelStats, setModelStats] = useState<SimulationModelStats | null>(null);
  const [results, setResults] = useState<Partial<Record<SimulationMode, ModeOutcome>>>({});
  const preparedRef = useRef<PreparedInputs | null>(null);
  // Mirror of preparedRef.current.settings for rendering.
  const [runSettings, setRunSettings] = useState<RunSettings | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (currentPortfolioValue > 0) {
      setInitialInvestment(currentPortfolioValue);
    }
  }, [currentPortfolioValue]);

  // Load full history if needed
  const ensureFullHistory = useCallback(async (): Promise<Portfolio | null> => {
    const heldPortfolio = portfolio.filter((item) => item.shares > 0);
    const needsFetch = heldPortfolio.some((item) => !hasDailyHistory(item.history) || !hasAdjustedHistory(item.history));

    let historyPortfolio = heldPortfolio;
    // Stored history that is long enough but has no adjusted closes is refetched
    // only to upgrade it to total return; if that fails the stored price history
    // still runs, and the details panel labels it price-only.
    const refetchIsUpgradeOnly = heldPortfolio.every((item) => hasDailyHistory(item.history));
    if (needsFetch) {
      setIsLoadingHistory(true);
      setError(null);

      try {
        const tickers = heldPortfolio.map((p) => p.ticker).join(",");
        const res = await fetch(
          `/api/market/chart?tickers=${encodeURIComponent(tickers)}&range=1Y&adjusted=1`,
        );
        if (!res.ok) throw new Error("Failed to fetch historical data");

        const { series } = await res.json();

        historyPortfolio = heldPortfolio.map((item) => {
          const points = series?.[item.ticker.toUpperCase()];
          return points?.length ? { ...item, history: points } : item;
        });
      } catch (e: any) {
        if (!refetchIsUpgradeOnly) {
          setError(`Error loading data: ${e.message}`);
          setIsLoadingHistory(false);
          return null;
        }
      }
    }

    if (mixedCurrency) {
      try {
        if (currency !== "CAD" || !fxProvenance || !Number.isFinite(fxProvenance.usdCad) || fxProvenance.usdCad <= 0) {
          throw new Error("A fresh CAD valuation and USD/CAD rate are required for mixed-currency simulation.");
        }
        const historyDates = historyPortfolio.flatMap((item) => (item.history ?? []).map((point) => point.date))
          .filter((date) => Number.isFinite(Date.parse(date)))
          .map((date) => new Date(Date.parse(date)).toISOString().slice(0, 10))
          .sort();
        const earliestDate = historyDates[0];
        const latestDate = historyDates[historyDates.length - 1];
        if (!earliestDate || !latestDate) throw new Error("Historical prices are unavailable for FX conversion.");
        const start = new Date(Date.parse(earliestDate) - 10 * 86_400_000).toISOString().slice(0, 10);
        const response = await fetch(`/api/market/fx-history?start_date=${start}&end_date=${latestDate}`);
        if (!response.ok) throw new Error("Historical FX data is unavailable.");
        const data = await response.json();
        if (!Array.isArray(data?.series)) throw new Error("Historical FX data is invalid.");
        const fxRates = data.series as HistoricalFxRate[];
        const converted = historyPortfolio.map((item) => {
          const history = convertPriceHistoryToCad(item.history ?? [], item.currency ?? "", fxRates);
          return history ? { ...item, currency: "CAD", history, price: item.currency === "USD" ? Number(item.price) * fxProvenance.usdCad : Number(item.price) } : null;
        });
        if (converted.some((item) => !item)) throw new Error("Historical FX does not cover every held price observation.");
        historyPortfolio = converted as Portfolio;
      } catch (e: any) {
        setError(e.message);
        setIsLoadingHistory(false);
        return null;
      }
    }
    setIsLoadingHistory(false);
    return historyPortfolio;
  }, [portfolio, mixedCurrency, currency, fxProvenance]);

  /** Runs the given modes on the prepared inputs, skipping ones already done. */
  const runModes = useCallback(async (modes: SimulationMode[], fresh = false) => {
    const inputs = preparedRef.current;
    if (!inputs || runningRef.current) return;
    const todo = fresh ? modes : modes.filter((m) => !results[m]);
    if (todo.length === 0) return;
    runningRef.current = true;
    setIsRunning(true);
    // Let the button state paint before the synchronous run.
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const next: Partial<Record<SimulationMode, ModeOutcome>> = {};
      for (const m of todo) next[m] = runMode(m, inputs);
      setResults((prev) => ({ ...(fresh ? {} : prev), ...next }));
    } catch (e: any) {
      setError(e?.message ?? "Simulation failed.");
    } finally {
      runningRef.current = false;
      setIsRunning(false);
    }
  }, [results]);

  // Prepare data for every portfolio asset, then run the visible mode(s).
  const prepareSimulation = useCallback(async () => {
    if (portfolio.length === 0) {
      setError("Portfolio is empty.");
      return;
    }

    // Validate the live portfolio valuation before loading history. An
    // unavailable value must never be replaced with a synthetic starting sum.
    if (!Number.isFinite(currentPortfolioValue) || currentPortfolioValue <= 0) {
      setError("Simulation requires a positive valued portfolio.");
      return;
    }
    if (!currency || !getPortfolioValuation(portfolio, currency, Date.now(), fxProvenance).complete) {
      setError("Simulation requires fresh, complete quotes and a valid currency for every holding.");
      return;
    }
    const heldPortfolio = portfolio.filter((item) => item.shares > 0);
    if (heldPortfolio.some((item) => !Number.isFinite(Number(item.price)) || Number(item.price) <= 0)) {
      setError("Simulation is unavailable until every holding has a valid positive quote.");
      return;
    }
    if (!Number.isFinite(initialInvestment) || initialInvestment <= 0) {
      setError("Enter a positive starting value to run the simulation.");
      return;
    }

    const activePortfolio = await ensureFullHistory();
    if (!activePortfolio) return;

    setError(null);

    const weights = getEffectiveWeights(activePortfolio);
    const aligned = alignPriceHistories(activePortfolio);
    const prices = aligned?.prices;
    const dates = aligned?.dates;
    const observationCount = prices?.[0]?.length ? prices[0].length - 1 : 0;
    if (!prices || !dates || observationCount < 200 || !hasDailyObservationCoverage(dates)) {
      setError(`Simulation needs at least 200 aligned daily returns for every holding; found ${observationCount}.`);
      return;
    }

    const returnsMatrix = prices.map(calculateLogReturns);
    if (returnsMatrix.some((returns) => returns.length !== observationCount)) {
      setError("Simulation history contains invalid prices and cannot be aligned safely.");
      return;
    }

    // Only Randomize needs the covariance factor; a failure here disables that mode alone.
    let ridge = 0;
    let covarianceOk = true;
    try {
      ({ ridge } = getRegularizedCholesky(calculateCovarianceMatrix(returnsMatrix)));
    } catch {
      covarianceOk = false;
    }

    const portfolioValues = dates.map((_, day) => activePortfolio.reduce(
      (sum, item, index) => sum + item.shares * prices[index][day], 0,
    ));
    if (portfolioValues.some((value) => !Number.isFinite(value) || value <= 0)) {
      setError("Simulation history contains invalid portfolio values.");
      return;
    }
    const portfolioReturns = calculateLogReturns(portfolioValues);
    const sampleMean = portfolioReturns.reduce((sum, value) => sum + value, 0) / observationCount;
    const sampleVariance = portfolioReturns.reduce(
      (sum, value) => sum + (value - sampleMean) ** 2, 0,
    ) / (observationCount - 1);

    const runSeed = reuseSeed && modelStats ? modelStats.seed : Math.floor(Math.random() * 0x7fffffff);
    setModelStats({
      ridge,
      covarianceOk,
      seed: runSeed,
      annualizedLogDrift: sampleMean * TRADING_DAYS,
      annualizedVolatility: Math.sqrt(sampleVariance * TRADING_DAYS),
      observationCount,
      lookbackStart: dates[0],
      lookbackEnd: dates[dates.length - 1],
      basis: aligned.basis,
    });

    const settings: RunSettings = {
      years: timeHorizonYears,
      drawnPaths: numSimulations,
      statsPaths,
      blockDays,
      initial: initialInvestment,
    };
    preparedRef.current = {
      returns: returnsMatrix,
      currentPrices: activePortfolio.map((item) => Number(item.price)),
      weights,
      seed: runSeed,
      covarianceOk,
      settings,
    };
    setRunSettings(settings);
    setInvestmentEdited(false);
    await runModes(compare ? MODE_ORDER : [mode], true);
  }, [
    portfolio, numSimulations, timeHorizonYears, statsPaths, blockDays, initialInvestment,
    currentPortfolioValue, ensureFullHistory, currency, fxProvenance, reuseSeed, modelStats,
    runModes, compare, mode,
  ]);

  // Switching mode or opening the comparison after a run reuses the prepared
  // inputs: no history refetch and the same seed base.
  useEffect(() => {
    if (!preparedRef.current) return;
    void runModes(compare ? MODE_ORDER : [mode]);
  }, [mode, compare, runModes]);

  const active = results[mode];
  const result = active && "summary" in active ? active : null;
  const unavailable = active && "unavailable" in active ? active.unavailable : null;
  const settings = result?.settings ?? runSettings;
  const settingsChanged = !!settings && (
    settings.years !== timeHorizonYears || settings.drawnPaths !== numSimulations ||
    settings.statsPaths !== statsPaths || settings.blockDays !== blockDays ||
    (investmentEdited && settings.initial !== initialInvestment)
  );
  const hasRun = Object.keys(results).length > 0;
  const showBand = bandOverride ?? mode !== "reshuffle";

  const years = result?.settings.years ?? timeHorizonYears;
  const initial = result?.settings.initial ?? initialInvestment;
  const summary = result?.summary;
  const medianCAGR = summary && initial > 0 ? Math.pow(summary.p50 / initial, 1 / years) - 1 : 0;
  const percentageGrowth = summary && initial > 0 ? ((summary.p50 - initial) / initial) * 100 : 0;
  const reshuffled = mode === "reshuffle";

  const horizonOptions = HORIZONS.includes(timeHorizonYears as (typeof HORIZONS)[number])
    ? HORIZONS
    : ([...HORIZONS, timeHorizonYears].sort((a, b) => a - b) as number[]);
  const chip = "ws-chip";
  const busy = isLoadingHistory || isRunning;

  // Reshuffled paths all end together, so their spread is shown halfway through instead.
  const mid = result ? Math.floor((result.band.days.length - 1) / 2) : 0;
  const tiles = summary ? [
    reshuffled
      ? { label: "Ending value", value: formatCurrency(summary.p50, currency), note: "Every order ends at this value" }
      : { label: "Typical ending", value: formatCurrency(summary.p50, currency), note: "Half of paths finished above this" },
    reshuffled && result
      ? {
          label: "Halfway range",
          value: `${formatCurrency(result.band.p10[mid], currency)} to ${formatCurrency(result.band.p90[mid], currency)}`,
          note: `8 in 10 paths were between these around year ${(result.band.days[mid] / result.daysPerYear).toFixed(0)}`,
        }
      : {
          label: "Range",
          value: `${formatCurrency(summary.p10, currency)} to ${formatCurrency(summary.p90, currency)}`,
          note: "8 in 10 paths finished between these",
        },
    reshuffled
      ? {
          label: "Dipped below start",
          value: pct(summary.everBelowStart),
          note: "Paths that fell below where they started at some point",
          tone: summary.everBelowStart > 0 ? "loss" : undefined,
        }
      : {
          label: "Chance of loss",
          value: pct(summary.chanceOfLoss),
          note: "Paths that ended below where they started",
          tone: summary.chanceOfLoss > 0 ? "loss" : undefined,
        },
    {
      label: "Worst drop",
      value: `−${pct(summary.maxDrawdown.p90)}`,
      note: `1 in 10 paths fell at least this far from a high point. Typical: −${pct(summary.maxDrawdown.p50)}. Measured month to month.`,
    },
  ] : [];

  const fanFor = (r: ModeResult, compact: boolean) => (
    <PathFan
      key={`${r.mode}-${r.settings.years}-${modelStats?.seed}-${compact}`}
      paths={r.drawn.paths}
      days={r.drawn.days}
      daysPerYear={r.daysPerYear}
      years={r.settings.years}
      start={r.settings.initial}
      color={MC_MODE_COLOR[r.mode]}
      colorAlt={MC_MODE_COLOR_ALT[r.mode]}
      highlight={r.highlight}
      highlightLabel={r.mode === "reshuffle" ? "The past year in its real order" : "Path with the median ending"}
      band={r.band}
      showBand={!compact && showBand}
      currency={currency}
      height={compact ? 120 : 320}
      compact={compact}
      label={`${MODE_INFO[r.mode].name}: ${r.drawn.paths.length} simulated paths over ${r.settings.years} years`}
    />
  );

  const histogramFor = (r: ModeResult, compact: boolean) => (
    <OutcomeHistogram
      bins={r.histogram}
      color={MC_MODE_COLOR[r.mode]}
      height={compact ? 120 : 220}
      compact={compact}
      label={`${MODE_INFO[r.mode].name}: ending returns of ${r.settings.statsPaths.toLocaleString()} paths. ${pct(r.summary.chanceOfLoss)} ended below the start.`}
    />
  );

  return (
    <div className="@container flex min-h-full flex-col gap-6 [&>*]:shrink-0">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-1 basis-72 items-start gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-75 hover:bg-surface-soft hover:text-ink md:h-9 md:w-9 focus-visible:outline-2 focus-visible:outline-compass"
              title="Back to Portfolio"
              aria-label="Back to Portfolio"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-semibold text-ink">
              Monte Carlo Simulation{" "}
              <span className="ml-1 rounded-full bg-surface-soft px-2 py-0.5 align-middle text-xs font-medium text-body">
                Beta
              </span>
            </h2>
            <p className="mt-1 max-w-xl text-sm text-body">
              See a range of ways your portfolio could grow, built from how its holdings have moved in the past. It shows {numSimulations} possible paths, not a prediction.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {result && summary && (
            <PortfolioShareButton
              portfolio={portfolio}
              metrics={{
                totalValue: currentPortfolioValue,
                annualReturn: medianCAGR,
                yield: null,
                projectedValue: summary.p50,
                totalInvested: initial,
                dividends: null,
                years,
                scenario: `Monte Carlo median (${MODE_INFO[mode].name})`,
                growthType: "Monte Carlo",
                percentageGrowth,
              }}
              history={result.band.days.map((day, i) => ({
                value: result.band.p50[i],
                min: result.band.p10[i],
                max: result.band.p90[i],
                date: `Y${(day / result.daysPerYear).toFixed(1)}`,
              }))}
            />
          )}

          <button
            onClick={prepareSimulation}
            disabled={busy}
            className="ws-pill ws-pill-primary h-11 whitespace-nowrap px-6 md:h-10"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : hasRun ? (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            {isLoadingHistory
              ? "Loading data..."
              : isRunning
                ? "Simulating..."
                : hasRun
                  ? "Run again"
                  : "Run simulation"}
          </button>
        </div>
      </div>

      {/* Setup: three plain questions */}
      <section aria-label="Simulation setup" className="ws-panel grid gap-x-8 gap-y-5 p-4 @2xl:grid-cols-[minmax(0,14rem)_1fr_auto] @2xl:p-6">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label htmlFor="mc-investment" className="text-sm text-muted">
              Investment
            </label>
            {currentPortfolioValue > 0 &&
              initialInvestment !== currentPortfolioValue && (
                <button
                  onClick={() => setInitialInvestment(currentPortfolioValue)}
                  className="inline-flex items-center gap-1 rounded text-sm text-compass hover:underline focus-visible:outline-2 focus-visible:outline-compass"
                  title="Reset to current portfolio value"
                >
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                  Use my portfolio
                </button>
              )}
          </div>
          <div className="flex items-center gap-2 border-b border-hairline pb-1 focus-within:border-compass">
            <span className="text-2xl text-muted" aria-hidden="true">$</span>
            <input
              id="mc-investment"
              type="number"
              aria-label={`Starting balance (${currency ?? "currency"})`}
              value={initialInvestment}
              onChange={(e) => {
                setInitialInvestment(Number(e.target.value));
                setInvestmentEdited(true);
              }}
              className="w-full bg-transparent text-2xl font-semibold tabular-nums text-ink outline-none"
            />
          </div>
          {currency && <p className="mt-1 text-sm text-muted">{currency}, today&apos;s value</p>}
        </div>

        <div>
          <div className="mb-2 text-sm text-muted" id="mc-horizon">For how long</div>
          <div role="group" aria-labelledby="mc-horizon" className="flex flex-wrap gap-2">
            {horizonOptions.map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={timeHorizonYears === y}
                onClick={() => setTimeHorizonYears(y)}
                className={cn(chip, "min-h-10 px-4 text-sm")}
              >
                {y} {y === 1 ? "year" : "years"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm text-muted" id="mc-paths">How many paths</div>
          <div role="group" aria-labelledby="mc-paths" className="flex flex-wrap gap-2">
            {PATH_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={numSimulations === n}
                onClick={() => setNumSimulations(n)}
                className={cn(chip, "min-h-10 px-4 text-sm")}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Mode switcher */}
      <section aria-label="Simulation type" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Simulation type" className="flex flex-wrap gap-2">
            {MODE_ORDER.map((m, i) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={!compare && mode === m}
                onClick={() => {
                  setMode(m);
                  setCompare(false);
                }}
                className={cn(chip, "min-h-10 gap-2 px-4 text-sm")}
              >
                <span className="tabular-nums text-muted">{i + 1}</span>
                <span className="h-2 w-2 rounded-full" style={{ background: MC_MODE_COLOR[m] }} aria-hidden="true" />
                {MODE_INFO[m].name}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={compare}
            onClick={() => setCompare((c) => !c)}
            className={cn(chip, "min-h-10 px-4 text-sm")}
          >
            Compare all three
          </button>
        </div>
        {!compare && (
          <p className="text-sm text-body">
            <span className="font-medium" style={{ color: MC_MODE_COLOR[mode] }}>{MODE_INFO[mode].name}:</span>{" "}
            {MODE_INFO[mode].line}
          </p>
        )}
      </section>

      <p className="max-w-3xl text-sm leading-6 text-muted">
        Illustrative scenarios, not forecasts or calibrated probabilities. {MODE_INFO[mode].method} Historical returns are total returns (distributions reinvested) when every holding has dividend-adjusted closes, and price returns otherwise; the model details panel says which. It assumes a buy-and-hold portfolio. Recurring contributions, withdrawals, rebalancing, fees, taxes, and extreme events are excluded.
      </p>
      {mixedCurrency && fxProvenance && (
        <p className="text-sm text-muted">
          Historical USD/CAD moves are included in the converted CAD return samples. Current USD quotes use {fxProvenance.usdCad} CAD/USD ({fxProvenance.date}); future FX is not modeled as a separate process or forecast.
        </p>
      )}

      {/* Error */}
      {error && (
        <div role="alert" className="ws-panel flex items-start gap-3 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
          <div>
            <p className="text-ink">{error}</p>
            {error.startsWith("Simulation requires a positive valued") && (
              <p className="mt-1 text-sm text-muted">Enter share counts for your holdings on the Portfolio tab, then run it again.</p>
            )}
          </div>
        </div>
      )}

      {settingsChanged && hasRun && (
        <p className="text-sm text-muted" role="status">
          Your settings changed since the last run. Press Run again to apply them.
        </p>
      )}

      {/* Compare all three */}
      {compare && hasRun && (
        <section aria-label="All three simulation types" className="flex flex-col gap-3">
          {MODE_ORDER.map((m, i) => {
            const r = results[m];
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setCompare(false);
                }}
                className="ws-panel block w-full p-4 text-left transition-colors hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-compass"
              >
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="text-lg font-semibold">
                    <span className="mr-2 tabular-nums text-muted">{i + 1}</span>
                    <span style={{ color: MC_MODE_COLOR[m] }}>{MODE_INFO[m].name}</span>
                  </h3>
                  {r && "summary" in r && (
                    <span className="text-sm text-body">
                      Typical {formatCurrency(r.summary.p50, currency)}
                      {m === "reshuffle"
                        ? ` · dipped below start in ${pct(r.summary.everBelowStart)}`
                        : ` · ${pct(r.summary.chanceOfLoss)} chance of loss`}
                    </span>
                  )}
                </div>
                {!r && <p className="py-8 text-sm text-muted">Simulating...</p>}
                {r && "unavailable" in r && <p className="py-4 text-sm text-muted">{r.unavailable}</p>}
                {r && "summary" in r && (m === "randomize" ? histogramFor(r, true) : fanFor(r, true))}
                <p className="mt-2 text-sm text-muted">{MODE_INFO[m].line}</p>
              </button>
            );
          })}
        </section>
      )}

      {/* Answer first */}
      <AnimatePresence>
        {!compare && result && summary && (
          <motion.section
            key={mode}
            aria-label="Simulation result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="flex flex-col gap-5"
          >
            <div>
              <p className="text-sm text-muted">
                {reshuffled
                  ? `In ${years} ${years === 1 ? "year" : "years"}, every reshuffled path ends at`
                  : `In ${years} ${years === 1 ? "year" : "years"}, a typical path ends near`}
              </p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-ink @2xl:text-5xl">
                {formatCurrency(summary.p50, currency)}
              </p>
              <p className="mt-2 text-sm text-body">
                <span style={{ color: percentageGrowth >= 0 ? GAIN : LOSS }}>{signedPercent(percentageGrowth)}</span>{" "}
                from {formatCurrency(initial, currency)}, or about{" "}
                <span style={{ color: medianCAGR >= 0 ? GAIN : LOSS }}>{signedPercent(medianCAGR * 100)}</span>{" "}
                a year.{" "}
                {reshuffled
                  ? "Order does not change where you end up, only how bumpy the way there is."
                  : "Half of the simulated paths finished higher and half lower."}
              </p>
              {modelStats && (
                <p className="mt-2 text-sm text-muted">
                  The paths assume the returns of {modelStats.lookbackStart} to {modelStats.lookbackEnd} repeat
                  every year. From {modelStats.observationCount} days of history, that average is only known to within
                  about ±{(196 * modelStats.annualizedVolatility / Math.sqrt(modelStats.observationCount / TRADING_DAYS)).toFixed(0)}{" "}
                  points a year (95% interval), so the middle path mostly reflects how that period went.
                </p>
              )}
            </div>

            <dl className="grid gap-px overflow-hidden rounded-lg bg-hairline ring-1 ring-hairline @xl:grid-cols-2 @4xl:grid-cols-4">
              {tiles.map((t) => (
                <div key={t.label} className="bg-surface-card px-4 py-3">
                  <dt className="text-sm text-muted">{t.label}</dt>
                  <dd
                    className="mt-1 text-xl font-semibold tabular-nums text-ink"
                    style={t.tone === "loss" ? { color: LOSS } : undefined}
                  >
                    {t.value}
                  </dd>
                  <dd className="mt-1 text-sm text-muted">{t.note}</dd>
                </div>
              ))}
            </dl>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Chart */}
      {!compare && (!error || hasRun) && (
        <div className="ws-panel relative overflow-hidden p-4 @2xl:p-6">
          {!hasRun && !error && (
            <div className="flex flex-col items-start gap-1 py-6">
              <p className="text-base font-medium text-ink">
                {busy ? "Simulating..." : "Your range of outcomes will appear here"}
              </p>
              <p className="text-sm text-muted">Press Run simulation to draw {numSimulations} possible paths over {timeHorizonYears} years.</p>
            </div>
          )}
          {hasRun && !active && (
            <p className="py-6 text-sm text-muted">Simulating {MODE_INFO[mode].name}...</p>
          )}
          {unavailable && <p className="py-6 text-sm text-ink">{unavailable}</p>}

          {result && (
            <div className="flex flex-col gap-6">
              {mode === "randomize" && (
                <div>
                  <p className="mb-3 text-sm font-medium text-ink">
                    How {result.settings.statsPaths.toLocaleString()} paths ended
                  </p>
                  {histogramFor(result, false)}
                  <p className="mt-2 text-sm text-muted">
                    Return after {years} {years === 1 ? "year" : "years"}. Bars left of Start are paths that lost money.
                  </p>
                </div>
              )}
              <div>
                {mode === "randomize" && (
                  <p className="mb-3 text-sm font-medium text-ink">{result.drawn.paths.length} of those paths over time</p>
                )}
                {fanFor(result, false)}
              </div>
              {mode === "resample" && (
                <details className="rounded-lg ring-1 ring-hairline">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-compass">
                    Show ending values as a histogram
                  </summary>
                  <div className="px-4 pb-4">{histogramFor(result, false)}</div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {hasRun && modelStats && (
        <details className="rounded-lg ring-1 ring-hairline">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-compass">
            Advanced and model details
          </summary>
          <div className="flex flex-col gap-5 px-4 pb-4">
            <div className="grid gap-x-8 gap-y-4 text-sm @xl:grid-cols-2">
              <div>
                <div className="mb-2 text-muted" id="mc-stats-paths">Paths behind the figures</div>
                <div role="group" aria-labelledby="mc-stats-paths" className="flex flex-wrap gap-2">
                  {STATS_PATH_OPTIONS.map((n) => (
                    <button key={n} type="button" aria-pressed={statsPaths === n} onClick={() => setStatsPaths(n)} className={cn(chip, "min-h-9 px-3 text-sm")}>
                      {n.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-muted" id="mc-block">Resample block length</div>
                <div role="group" aria-labelledby="mc-block" className="flex flex-wrap gap-2">
                  {BLOCK_OPTIONS.map((b) => (
                    <button key={b.days} type="button" aria-pressed={blockDays === b.days} onClick={() => setBlockDays(b.days)} className={cn(chip, "min-h-9 px-3 text-sm")}>
                      {b.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-muted">Longer blocks keep calm and stormy stretches together.</p>
              </div>
              <label className="flex items-center gap-2 text-muted">
                <input type="checkbox" checked={showBand} onChange={(e) => setBandOverride(e.target.checked)} />
                Show where 8 in 10 paths were, behind the paths
              </label>
            </div>

            {summary && (
              <table className="w-full max-w-md text-sm">
                <caption className="mb-2 text-left text-muted">Ending value percentiles ({MODE_INFO[mode].name})</caption>
                <tbody>
                  {([
                    ["5th", summary.p05], ["10th", summary.p10], ["25th", summary.p25], ["50th", summary.p50],
                    ["75th", summary.p75], ["90th", summary.p90], ["95th", summary.p95],
                  ] as const).map(([label, value]) => (
                    <tr key={label} className="border-t border-hairline">
                      <th scope="row" className="py-1.5 text-left font-normal text-muted">{label} percentile</th>
                      <td className="py-1.5 text-right font-medium tabular-nums text-ink">{formatCurrency(value, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <dl className="grid gap-x-8 gap-y-3 text-sm @xl:grid-cols-2">
              <div>
                <dt className="text-muted">Historical annualized log drift</dt>
                <dd className="font-medium tabular-nums text-ink">{(modelStats.annualizedLogDrift * 100).toFixed(2)}%</dd>
              </div>
              <div>
                <dt className="text-muted">Historical annualized volatility</dt>
                <dd className="font-medium tabular-nums text-ink">{(modelStats.annualizedVolatility * 100).toFixed(2)}%</dd>
              </div>
              {mode === "randomize" ? (
                <div>
                  <dt className="text-muted">Historical covariance model</dt>
                  <dd className="font-medium text-ink">
                    {!modelStats.covarianceOk
                      ? "Unavailable: the historical covariance is not positive definite"
                      : modelStats.ridge > 0
                        ? `Historical sample, with a small ridge (${modelStats.ridge} × average variance) because some holdings move almost identically`
                        : "Historical sample"}
                  </dd>
                </div>
              ) : (
                <div>
                  <dt className="text-muted">Filling the horizon</dt>
                  <dd className="font-medium text-ink">
                    {mode === "reshuffle"
                      ? `The past year's ${modelStats.observationCount} days, repeated ${years} ${years === 1 ? "time" : "times"} in a random order`
                      : `Days drawn at random from the past ${modelStats.observationCount}, in blocks of ${result?.settings.blockDays ?? blockDays} ${(result?.settings.blockDays ?? blockDays) === 1 ? "day" : "days"}`}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-muted">Aligned daily returns</dt>
                <dd className="font-medium tabular-nums text-ink">{modelStats.observationCount}</dd>
              </div>
              <div>
                <dt className="text-muted">Random seed</dt>
                <dd className="font-medium tabular-nums text-ink">{modelStats.seed}</dd>
                <label className="mt-1 flex items-center gap-2 text-muted">
                  <input type="checkbox" checked={reuseSeed} onChange={(e) => setReuseSeed(e.target.checked)} />
                  Reuse this seed on the next run to get the same paths
                </label>
              </div>
              <div className="@xl:col-span-2">
                <dt className="text-muted">Observed lookback</dt>
                <dd className="font-medium text-ink">{modelStats.lookbackStart} to {modelStats.lookbackEnd} · daily closes · {modelStats.basis === "total" ? "total returns (dividend-adjusted closes, distributions reinvested)" : "price returns only (adjusted closes unavailable for at least one holding)"}</dd>
              </div>
            </dl>
          </div>
        </details>
      )}

      {/* Explainer Section */}
      <div className="pb-12">
        <SimulatorExplainer mode="MONTE_CARLO" />
      </div>
    </div>
  );
}
