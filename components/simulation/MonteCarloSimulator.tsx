"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import { fetchChart } from "@/lib/api-client";
import { Portfolio } from "@/types";
import { m as motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Play,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { calculateLogReturns, calculateCovarianceMatrix } from "@/lib/math/stats";
import {
  getRegularizedCholesky,
  returnHistogram,
  rebaseLogDrift,
  dropOutlierDays,
  type SimulationMode,
} from "@/lib/monte-carlo";
import {
  getEffectiveWeights,
  getPortfolioMarketValue,
  getPortfolioCurrency,
} from "@/lib/math/portfolio-returns";
import {
  alignPriceHistories,
  type ReturnBasis,
  hasDailyObservationCoverage,
  observationsPerYear,
  tickersWithoutAdjustedHistory,
  diagnoseHistory,
} from "@/lib/math/history";
import { convertPriceHistoryToCad, type HistoricalFxRate } from "@/lib/math/fx-history";
import { getPortfolioValuation, type BankOfCanadaFxRate } from "@/lib/math/portfolio-returns";
import { GAIN, LOSS, MC_MODE_COLOR, MC_MODE_COLOR_ALT } from "@/lib/chart-colors";
import { PortfolioShareButton } from "../PortfolioShareButton";
import SimulatorExplainer from "./SimulatorExplainer";
import PathFan from "./PathFan";
import OutcomeHistogram from "./OutcomeHistogram";
import { signedPercent } from "@/lib/format";
import { impliedAnnualReturn } from "@/lib/math/scenario";
import {
  hasAdjustedHistory,
  hasDailyHistory,
  historyProblemMessage,
  presentResult,
  runMode,
  yieldToBrowser,
  type ModeOutcome,
  type ModeResult,
  type PreparedInputs,
  type ReturnModel,
  type RunSettings,
} from "@/lib/monte-carlo-run";
import { EASE } from "@/lib/motion";
import { HelpTip } from "@/components/ui/HelpTip";
import { cn } from "@/lib/cn";
import { isoDay, shiftIsoDate } from "@/lib/dates";

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
/** Annual drift outside this range is flagged: one year of history is a weak guide. */
const DRIFT_WARN_HIGH = 0.2;
const DRIFT_WARN_LOW = -0.1;
const DEFAULT_LONG_RUN_PERCENT = 7;
const BALANCE_MESSAGE = "Enter a starting balance above 0 to run the simulation.";

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
  /** Added at the end of each month, in today's money terms of the starting currency. */
  monthlyContribution?: number;
  /** Annual inflation in percent. Enables the "Show in today's money" view when above 0. */
  inflationPercent?: number;
  /** When above 0, shows the share of paths that reach this ending value. */
  goalAmount?: number;
}

interface SimulationModelStats {
  /** Fraction of average variance added to the diagonal for near-duplicate holdings; 0 if none. */
  ridge: number;
  /** False when the covariance cannot be factored, which only rules out Randomize. */
  covarianceOk: boolean;
  /** Historical annual log drift of the weighted portfolio. */
  annualizedLogDrift: number;
  /** Historical annual volatility of the weighted portfolio. */
  annualizedVolatility: number;
  observationCount: number;
  periodsPerYear: number;
  /** Days removed as unusual price jumps before simulating. */
  droppedDays: number;
  /** Holdings without dividend-adjusted history; empty on the total-return basis. */
  priceOnlyTickers: string[];
  lookbackStart: string;
  lookbackEnd: string;
  /** What the drift and volatility are computed from. */
  basis: ReturnBasis;
  /** Seed the paths were drawn with; reusing it reproduces them exactly. */
  seed: number;
}

/** Whole percent; a small but nonzero share reads "<1%" rather than a misleading 0%. */
const pct = (v: number) => (v > 0 && v < 0.005 ? "<1%" : `${Math.round(v * 100)}%`);

/** "AAPL", "AAPL and MSFT", "AAPL, MSFT and VTI". */
/** The message of a thrown value; "unknown error" when it has none. */
function errorMessage(e: unknown): string {
  return (e as { message?: string } | null | undefined)?.message ?? "unknown error";
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export default function MonteCarloSimulator({
  portfolio,
  baseCurrency,
  startingValue,
  fxProvenance,
  onBack,
  monthlyContribution,
  inflationPercent,
  goalAmount,
}: MonteCarloSimulatorProps) {
  const heldPortfolio = portfolio.filter((item) => item.shares > 0);
  const currency = baseCurrency ?? getPortfolioCurrency(portfolio) ?? undefined;
  const mixedCurrency = new Set(heldPortfolio.map((item) => item.currency)).size > 1;
  // Valuation date for FX conversion, captured once when the simulator mounts.
  const [valuationTime] = useState(() => Date.now());
  const currentPortfolioValue = useMemo(() => {
    const value = startingValue ??
      (mixedCurrency && currency ? getPortfolioValuation(portfolio, currency, valuationTime, fxProvenance).totalValue ?? NaN : getPortfolioMarketValue(portfolio));
    // Whole cents, so the box never shows float noise such as 8172.7000000000001.
    return Math.round(value * 100) / 100;
  }, [portfolio, startingValue, mixedCurrency, currency, fxProvenance, valuationTime]);
  const contributionAmount = monthlyContribution && monthlyContribution > 0 ? monthlyContribution : 0;
  const inflationRate = inflationPercent && inflationPercent > 0 ? inflationPercent / 100 : 0;
  const goal = goalAmount && goalAmount > 0 ? goalAmount : 0;

  // Setup
  const [mode, setMode] = useState<SimulationMode>("resample");
  const [compare, setCompare] = useState(false);
  const [numSimulations, setNumSimulations] = useState(50);
  const [timeHorizonYears, setTimeHorizonYears] = useState(10);
  const [statsPaths, setStatsPaths] = useState<number>(DEFAULT_STATS_PATHS);
  const [blockDays, setBlockDays] = useState(1);
  const [bandOverride, setBandOverride] = useState<boolean | null>(null);
  const [returnModel, setReturnModel] = useState<ReturnModel>("past");
  const [longRunPercent, setLongRunPercent] = useState<number>(DEFAULT_LONG_RUN_PERCENT);
  const [todaysMoney, setTodaysMoney] = useState(false);
  // Do not invent a balance when the portfolio value is unavailable.
  const [initialInvestment, setInitialInvestment] = useState<number>(
    Number.isFinite(currentPortfolioValue) ? currentPortfolioValue : 0,
  );
  const [reuseSeed, setReuseSeed] = useState(false);
  // Live quotes keep re-syncing the investment until the user types a value; the typed value then stays until reset.
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

  // Follow live quotes until the user types their own value.
  if (!investmentEdited && currentPortfolioValue > 0 && initialInvestment !== currentPortfolioValue) {
    setInitialInvestment(currentPortfolioValue);
  }

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
        const { series } = await fetchChart({ tickers, range: "1Y", adjusted: true });

        historyPortfolio = heldPortfolio.map((item) => {
          const points = series?.[item.ticker.toUpperCase()];
          return points?.length ? { ...item, history: points } : item;
        });
      } catch (e) {
        if (!refetchIsUpgradeOnly) {
          setError(`Error loading data: ${errorMessage(e)}`);
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
          .map((date) => isoDay(date))
          .sort();
        const earliestDate = historyDates[0];
        const latestDate = historyDates[historyDates.length - 1];
        if (!earliestDate || !latestDate) throw new Error("Historical prices are unavailable for FX conversion.");
        const start = shiftIsoDate(earliestDate, -10);
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
      } catch (e) {
        setError(errorMessage(e));
        setIsLoadingHistory(false);
        return null;
      }
    }
    setIsLoadingHistory(false);
    return historyPortfolio;
  }, [portfolio, mixedCurrency, currency, fxProvenance]);

  /** Runs the given modes on the prepared inputs, skipping ones already done. A failure in one mode leaves the others. */
  const runModes = useCallback(async (modes: SimulationMode[], fresh = false) => {
    const inputs = preparedRef.current;
    if (!inputs || runningRef.current) return;
    const todo = fresh ? modes : modes.filter((m) => !results[m]);
    if (todo.length === 0) return;
    runningRef.current = true;
    setIsRunning(true);
    try {
      for (const [index, m] of todo.entries()) {
        // Let the page respond between modes.
        await yieldToBrowser();
        let outcome: ModeOutcome;
        try {
          outcome = await runMode(m, inputs);
        } catch (e) {
          outcome = { mode: m, unavailable: `${MODE_INFO[m].name} could not run: ${errorMessage(e)}.` };
        }
        const clear = fresh && index === 0;
        setResults((prev) => ({ ...(clear ? {} : prev), [m]: outcome }));
      }
    } finally {
      runningRef.current = false;
      setIsRunning(false);
    }
  }, [results]);

  // Prepare data for every portfolio asset, then run the visible mode(s).
  const prepareSimulation = useCallback(async () => {
    // A balance the user typed as 0 or less is reported as such, not as a missing portfolio.
    if (investmentEdited && !(initialInvestment > 0)) {
      setError(BALANCE_MESSAGE);
      return;
    }
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
      setError(BALANCE_MESSAGE);
      return;
    }
    if (returnModel === "long" && !(Number.isFinite(longRunPercent) && longRunPercent > -100)) {
      setError("Enter a long-run annual return above -100%.");
      return;
    }

    const activePortfolio = await ensureFullHistory();
    if (!activePortfolio) return;

    setError(null);

    const diagnosis = diagnoseHistory(activePortfolio);
    if (!diagnosis.ok) {
      setError(historyProblemMessage(diagnosis));
      return;
    }

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

    const periodsPerYear = Math.max(1, Math.round(observationsPerYear(dates)));
    // Single-day jumps that look like data errors are removed before anything is simulated.
    const cleaned = dropOutlierDays(returnsMatrix);
    const returnsForRun = returnModel === "long"
      ? rebaseLogDrift(cleaned.returns, weights, Math.log(1 + longRunPercent / 100), periodsPerYear)
      : cleaned.returns;

    // Only Randomize needs the covariance factor; a failure here disables that mode alone.
    let ridge = 0;
    let covarianceOk = true;
    try {
      ({ ridge } = getRegularizedCholesky(calculateCovarianceMatrix(cleaned.returns)));
    } catch {
      covarianceOk = false;
    }

    // Historical drift and volatility come from the weighted portfolio the simulation uses.
    const index = dates.map((_, day) => weights.reduce(
      (sum, w, i) => sum + w * (prices[i][day] / prices[i][0]), 0,
    ));
    if (index.some((value) => !Number.isFinite(value) || value <= 0)) {
      setError("Simulation history contains invalid portfolio values.");
      return;
    }
    const indexReturns = calculateLogReturns(index);
    const sampleMean = indexReturns.reduce((sum, value) => sum + value, 0) / observationCount;
    const sampleVariance = indexReturns.reduce(
      (sum, value) => sum + (value - sampleMean) ** 2, 0,
    ) / (observationCount - 1);

    const runSeed = reuseSeed && modelStats ? modelStats.seed : Math.floor(Math.random() * 0x7fffffff);
    setModelStats({
      ridge,
      covarianceOk,
      seed: runSeed,
      annualizedLogDrift: sampleMean * periodsPerYear,
      annualizedVolatility: Math.sqrt(sampleVariance * periodsPerYear),
      observationCount,
      periodsPerYear,
      droppedDays: cleaned.dropped,
      priceOnlyTickers: aligned.basis === "price" ? tickersWithoutAdjustedHistory(activePortfolio) : [],
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
      returnModel,
      longRunPercent,
      monthlyContribution: contributionAmount,
    };
    preparedRef.current = {
      returns: returnsForRun,
      currentPrices: activePortfolio.map((item) => Number(item.price)),
      weights,
      seed: runSeed,
      periodsPerYear,
      covarianceOk,
      settings,
    };
    setRunSettings(settings);
    await runModes(compare ? MODE_ORDER : [mode], true);
  }, [
    portfolio, numSimulations, timeHorizonYears, statsPaths, blockDays, initialInvestment,
    currentPortfolioValue, ensureFullHistory, currency, fxProvenance, reuseSeed, modelStats,
    runModes, compare, mode, investmentEdited, returnModel, longRunPercent, contributionAmount,
  ]);

  // Switching mode or opening the comparison after a run reuses the prepared
  // inputs: no history refetch and the same seed base.
  useEffect(() => {
    if (!preparedRef.current) return;
    void runModes(compare ? MODE_ORDER : [mode]);
  }, [mode, compare, runModes]);

  const active = results[mode];
  const activeResult = active && "summary" in active ? active : null;
  const unavailable = active && "unavailable" in active ? active.unavailable : null;
  const settings = activeResult?.settings ?? runSettings;
  const settingsChanged = !!settings && (
    settings.years !== timeHorizonYears || settings.drawnPaths !== numSimulations ||
    settings.statsPaths !== statsPaths || settings.blockDays !== blockDays ||
    settings.returnModel !== returnModel ||
    (returnModel === "long" && settings.longRunPercent !== longRunPercent) ||
    settings.monthlyContribution !== contributionAmount ||
    (investmentEdited && settings.initial !== initialInvestment)
  );
  const hasRun = Object.keys(results).length > 0;
  const showBand = bandOverride ?? mode !== "reshuffle";

  const realView = inflationRate > 0 && todaysMoney;
  /** A result as displayed: in today's money when that view is on. */
  const present = (o: ModeOutcome | undefined): ModeOutcome | undefined =>
    o && "summary" in o && realView ? presentResult(o, inflationRate) : o;
  const result = activeResult ? (present(activeResult) as ModeResult) : null;

  const years = result?.settings.years ?? timeHorizonYears;
  const initial = result?.settings.initial ?? initialInvestment;
  const summary = result?.summary;
  // With monthly contributions the gain is measured on everything put in, not on the starting balance alone.
  const monthlyIn = result?.settings.monthlyContribution ?? 0;
  const totalIn = initial + monthlyIn * 12 * years;
  const medianCAGR = summary && initial > 0
    ? (monthlyIn > 0
      ? impliedAnnualReturn(initial, monthlyIn, years, summary.p50) ?? 0
      : Math.pow(summary.p50 / initial, 1 / years) - 1)
    : 0;
  const percentageGrowth = summary && totalIn > 0 ? ((summary.p50 - totalIn) / totalIn) * 100 : 0;
  const reshuffled = mode === "reshuffle";

  const horizonOptions = HORIZONS.includes(timeHorizonYears as (typeof HORIZONS)[number])
    ? HORIZONS
    : ([...HORIZONS, timeHorizonYears].sort((a, b) => a - b) as number[]);
  const chip = "ws-chip";
  const busy = isLoadingHistory || isRunning;

  // Reshuffled paths all end together, so their spread is shown halfway through instead.
  const mid = result ? Math.floor((result.band.days.length - 1) / 2) : 0;
  const count = (result?.settings.statsPaths ?? statsPaths).toLocaleString();
  /** A share from simulation is never exactly zero, so zero reads as "None" rather than 0%. */
  const shareValue = (share: number) => (share > 0 ? pct(share) : "None");
  const tiles = summary && result ? [
    reshuffled
      ? { label: "Ending value", value: formatCurrency(summary.p50, currency), note: "Every order ends at this value" }
      : { label: "Typical ending", value: formatCurrency(summary.p50, currency), note: "Half of paths finished above this" },
    reshuffled
      ? {
          label: "Halfway range",
          value: `${formatCurrency(result.band.p10[mid], currency)} to ${formatCurrency(result.band.p90[mid], currency)}`,
          note: `8 in 10 paths were between these around year ${(result.band.days[mid] / result.periodsPerYear).toFixed(0)}`,
        }
      : {
          label: "Range",
          value: `${formatCurrency(summary.p10, currency)} to ${formatCurrency(summary.p90, currency)}`,
          note: "8 in 10 paths finished between these",
        },
    reshuffled
      ? {
          label: "Dipped below start",
          value: shareValue(summary.everBelowStart),
          note: summary.everBelowStart > 0
            ? "Paths that fell below where they started at some point"
            : `None of the ${count} simulated paths fell below where they started`,
          tone: summary.everBelowStart > 0 ? "loss" : undefined,
        }
      : {
          label: "Chance of loss",
          value: shareValue(summary.chanceOfLoss),
          note: summary.chanceOfLoss > 0
            ? "Paths that ended below where they started"
            : `None of the ${count} simulated paths ended below where they started`,
          tone: summary.chanceOfLoss > 0 ? "loss" : undefined,
        },
    {
      label: "Worst drop",
      value: `−${pct(summary.maxDrawdown.p90)}`,
      note: `1 in 10 paths fell at least this far from a high point. Typical: −${pct(summary.maxDrawdown.p50)}. Measured month to month.`,
    },
    ...(goal > 0 ? [(() => {
      const reaching = result.finals.filter((f) => f >= goal).length / Math.max(1, result.finals.length);
      return {
        label: `Chance of reaching ${formatCurrency(goal, currency)}`,
        value: shareValue(reaching),
        note: reaching > 0
          ? "Paths that ended at or above this amount"
          : `None of the ${count} simulated paths ended at or above this amount`,
        tone: undefined,
      };
    })()] : []),
  ] : [];

  const fanFor = (r: ModeResult, compact: boolean) => (
    <PathFan
      key={`${r.mode}-${r.settings.years}-${modelStats?.seed}-${compact}-${realView}`}
      paths={r.drawn.paths}
      days={r.drawn.days}
      daysPerYear={r.periodsPerYear}
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
      bins={returnHistogram(r.finals.map((f) => f / r.settings.initial - 1), 30)}
      color={MC_MODE_COLOR[r.mode]}
      height={compact ? 120 : 220}
      compact={compact}
      label={`${MODE_INFO[r.mode].name}: ending returns of ${r.settings.statsPaths.toLocaleString()} paths. ${pct(r.summary.chanceOfLoss)} ended below the start.`}
    />
  );

  const driftWarning = modelStats && (modelStats.annualizedLogDrift > DRIFT_WARN_HIGH || modelStats.annualizedLogDrift < DRIFT_WARN_LOW);

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
                totalInvested: totalIn,
                contributionsModeled: monthlyIn > 0,
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
                date: `Y${(day / result.periodsPerYear).toFixed(1)}`,
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

      {/* Setup: plain questions */}
      <section aria-label="Simulation setup" className="ws-panel grid gap-x-8 gap-y-5 p-4 @2xl:grid-cols-[minmax(0,14rem)_1fr_auto] @2xl:p-6">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label htmlFor="mc-investment" className="text-sm text-muted">
              Investment
            </label>
            {currentPortfolioValue > 0 &&
              initialInvestment !== currentPortfolioValue && (
                <button
                  onClick={() => {
                    setInvestmentEdited(false);
                    setInitialInvestment(currentPortfolioValue);
                  }}
                  className="inline-flex items-center gap-1 rounded text-sm text-compass hover:underline focus-visible:outline-2 focus-visible:outline-compass"
                  title="Reset to current portfolio value"
                >
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                  Use my portfolio value
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

        <div className="@2xl:col-span-full">
          <div className="mb-2 text-sm text-muted" id="mc-return">Return assumption</div>
          <div role="group" aria-labelledby="mc-return" className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={returnModel === "past"}
              onClick={() => setReturnModel("past")}
              className={cn(chip, "min-h-10 px-4 text-sm")}
            >
              Past year
            </button>
            <button
              type="button"
              aria-pressed={returnModel === "long"}
              onClick={() => setReturnModel("long")}
              className={cn(chip, "min-h-10 px-4 text-sm")}
            >
              Long-run
            </button>
            {returnModel === "long" && (
              <label className="flex items-center gap-2 text-sm text-body">
                <span>Annual total return</span>
                <input
                  type="number"
                  aria-label="Long-run annual return (%)"
                  step="0.5"
                  value={longRunPercent}
                  onChange={(e) => setLongRunPercent(Number(e.target.value))}
                  className="w-20 rounded border border-hairline bg-transparent px-2 py-1 tabular-nums text-ink outline-none focus-visible:outline-2 focus-visible:outline-compass"
                />
                <span>%</span>
              </label>
            )}
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
        Illustrative scenarios, not forecasts or calibrated probabilities. {MODE_INFO[mode].method} Historical returns are total returns (distributions reinvested) when every holding has dividend-adjusted closes, and price returns otherwise; the model details panel says which. It assumes a buy-and-hold portfolio. {contributionAmount > 0 ? "A monthly contribution is included; withdrawals" : "Recurring contributions, withdrawals"}, rebalancing, fees, taxes, and extreme events are excluded.
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
            const outcome = results[m];
            const r = present(outcome);
            const count = (outcome && "settings" in outcome ? outcome.settings.statsPaths : statsPaths).toLocaleString();
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
                        ? ` · ${r.summary.everBelowStart > 0 ? `dipped below start in ${pct(r.summary.everBelowStart)}` : "never dipped below start"}`
                        : ` · ${r.summary.chanceOfLoss > 0 ? `${pct(r.summary.chanceOfLoss)} chance of loss` : `none of the ${count} simulated paths lost money`}`}
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
              {inflationRate > 0 && (
                <button
                  type="button"
                  aria-pressed={todaysMoney}
                  onClick={() => setTodaysMoney((v) => !v)}
                  className={cn(chip, "mb-3 min-h-9 px-3 text-sm")}
                >
                  Show in today&apos;s money
                </button>
              )}
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
                {monthlyIn > 0
                  ? `on the ${formatCurrency(totalIn, currency)} put in (starting balance plus contributions), or about`
                  : `from ${formatCurrency(initial, currency)}, or about`}{" "}
                <span style={{ color: medianCAGR >= 0 ? GAIN : LOSS }}>{signedPercent(medianCAGR * 100)}</span>{" "}
                a year.{" "}
                {reshuffled
                  ? "Order does not change where you end up, only how bumpy the way there is."
                  : "Half of the simulated paths finished higher and half lower."}
              </p>
              {realView && (
                <p className="mt-2 text-sm text-muted">
                  Values are in today&apos;s money, after {inflationPercent}% a year inflation.
                </p>
              )}
              {modelStats?.basis === "price" && (
                <p className="mt-3 rounded-md bg-surface-soft px-3 py-2 text-sm text-ink">
                  Returns exclude dividends because {modelStats.priceOnlyTickers.length > 0 ? joinNames(modelStats.priceOnlyTickers) : "a holding"}{" "}
                  {modelStats.priceOnlyTickers.length > 1 ? "have" : "has"} no dividend-adjusted history.
                </p>
              )}
              {driftWarning && modelStats && (
                <p className="mt-3 rounded-md bg-surface-soft px-3 py-2 text-sm text-ink">
                  The past year&apos;s drift of {(modelStats.annualizedLogDrift * 100).toFixed(1)}% a year is unusually {modelStats.annualizedLogDrift > 0 ? "high" : "low"}.
                  One year of history is a weak guide to the long run.
                </p>
              )}
              {modelStats && (
                <p className="mt-2 text-sm text-muted">
                  The paths assume the returns of {modelStats.lookbackStart} to {modelStats.lookbackEnd} repeat
                  every year. From {modelStats.observationCount} days of history, that average is only known to within
                  about ±{(196 * modelStats.annualizedVolatility / Math.sqrt(modelStats.observationCount / modelStats.periodsPerYear)).toFixed(0)}{" "}
                  points a year (95% interval), so the middle path mostly reflects how that period went.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1 text-sm text-muted">
              <p>
                {result.settings.returnModel === "long" ? (
                  <>
                    Assumes a long-run return of {result.settings.longRunPercent}% a year; <HelpTip term="volatility">volatility</HelpTip> and correlations come from the past year.
                  </>
                ) : (
                  `Based on the past year's returns, repeated for ${years} ${years === 1 ? "year" : "years"}.`
                )}
                {result.settings.monthlyContribution > 0 &&
                  ` Includes a contribution of ${formatCurrency(result.settings.monthlyContribution, currency)} a month.`}
              </p>
              {modelStats && modelStats.droppedDays > 0 && (
                <p>
                  {modelStats.droppedDays} unusual price {modelStats.droppedDays === 1 ? "jump was" : "jumps were"} ignored.
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
                <dt className="text-muted">
                  <HelpTip term="volatility">Historical annualized volatility</HelpTip>
                </dt>
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
