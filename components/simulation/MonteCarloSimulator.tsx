"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
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
  getCholeskyDecomposition,
  generateMonteCarloPaths,
  calculateCone,
  calculateQuantile,
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
import { PortfolioShareButton } from "../PortfolioShareButton";
import SimulatorExplainer from "./SimulatorExplainer";
import { EASE } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils";

const HORIZONS = [5, 10, 15, 20, 30] as const;
const PATH_COUNTS = [20, 50, 100] as const;
/**
 * The drawn paths are few so they stay legible, but a 5th percentile from 20
 * paths is roughly the second-worst path. The bands and the risk figures come
 * from a separate, larger run stepped monthly (21 trading days).
 */
const STATS_PATHS = 2000;
const STATS_STEP_DAYS = 21;

/** Whole years on the x axis, thinned so long horizons stay readable. */
function yearTicks(years: number) {
  const step = years <= 10 ? 1 : years <= 20 ? 2 : 5;
  const out: number[] = [];
  for (let y = 0; y <= years; y += step) out.push(y * 252);
  return out;
}

function compactMoney(v: number, currency?: string) {
  const code = currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined;
  return new Intl.NumberFormat("en-CA", {
    ...(code ? { style: "currency" as const, currency: code, currencyDisplay: "narrowSymbol" as const } : {}),
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
}

const signedPercent = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;

interface MonteCarloSimulatorProps {
  portfolio: Portfolio;
  baseCurrency?: string;
  startingValue?: number;
  fxProvenance?: BankOfCanadaFxRate;
  onBack?: () => void;
}

interface SimulationModelStats {
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

function hasDailyHistory(points: Portfolio[0]["history"]): boolean {
  return !!points && points.length >= 200 &&
    hasDailyObservationCoverage(points.map((point) => point.date));
}

/** Stored history from before adjusted closes were fetched is refetched, so existing portfolios move to total return. */
function hasAdjustedHistory(points: Portfolio[0]["history"]): boolean {
  return selectReturnBasis([points ?? []]) === "total";
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
  // Market value across *all* holdings

  // State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationComplete, setSimulationComplete] = useState(false);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [numSimulations, setNumSimulations] = useState(50);
  const [timeHorizonYears, setTimeHorizonYears] = useState(10);

  // Do not invent a balance when the portfolio value is unavailable.
  const [initialInvestment, setInitialInvestment] = useState<number>(
    Number.isFinite(currentPortfolioValue) ? currentPortfolioValue : 0,
  );

  const [reuseSeed, setReuseSeed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [modelStats, setModelStats] = useState<SimulationModelStats | null>(
    null,
  );

  // Animation Ref
  const animationFrameRef = useRef<number>(0);
  const allPathsRef = useRef<number[][]>([]);
  const coneRef = useRef<any>(null);
  const statsFinalRef = useRef<number[]>([]);

  // Effect to sync initialInvestment with portfolio value if it loads later and we are at default
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

  // Prepare data for every portfolio asset.
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

    const fetchedPortfolio = await ensureFullHistory();
    if (!fetchedPortfolio) return;

    setError(null);
    setSimulationComplete(false);
    setCurrentDayIndex(0);

    const activePortfolio = fetchedPortfolio;
    const n = activePortfolio.length;

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
    const covMatrix = calculateCovarianceMatrix(returnsMatrix);
    const meanReturns = returnsMatrix.map(
      (returns) => returns.reduce((sum, value) => sum + value, 0) / returns.length,
    );

    let cholesky: number[][];
    try {
      cholesky = getCholeskyDecomposition(covMatrix);
    } catch {
      setError("Simulation unavailable: historical covariance is not positive definite, so correlations cannot be modeled reliably.");
      return;
    }

    const currentPrices = activePortfolio.map((item) => Number(item.price));

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
      seed: runSeed,
      annualizedLogDrift: sampleMean * 252,
      annualizedVolatility: Math.sqrt(sampleVariance * 252),
      observationCount,
      lookbackStart: dates[0],
      lookbackEnd: dates[dates.length - 1],
      basis: aligned.basis,
    });

    const numDays = timeHorizonYears * 252;

    const paths = generateMonteCarloPaths(
      currentPrices,
      weights,
      meanReturns,
      cholesky,
      numSimulations,
      numDays,
      initialInvestment,
      runSeed,
    );

    const statsPaths = generateMonteCarloPaths(
      currentPrices,
      weights,
      meanReturns,
      cholesky,
      STATS_PATHS,
      (timeHorizonYears * 252) / STATS_STEP_DAYS,
      initialInvestment,
      (runSeed + 1) | 0,
      STATS_STEP_DAYS,
    );

    allPathsRef.current = paths;
    coneRef.current = calculateCone(statsPaths);
    statsFinalRef.current = statsPaths.map((p) => p[p.length - 1]);
    setIsSimulating(true);
  }, [
    portfolio,
    numSimulations,
    timeHorizonYears,
    initialInvestment,
    currentPortfolioValue,
    ensureFullHistory,
    currency,
    fxProvenance,
    reuseSeed,
    modelStats,
  ]);

  // Animation Loop
  useEffect(() => {
    if (!isSimulating) return;

    let step = 0;
    const totalSteps = allPathsRef.current[0].length;
    // Speed up: render more steps per frame
    const batchSize = Math.max(10, Math.floor(totalSteps / 60));

    const animate = () => {
      step += batchSize;
      if (step >= totalSteps) {
        step = totalSteps;
        setCurrentDayIndex(step);
        setIsSimulating(false);
        setSimulationComplete(true);
        return;
      }
      setCurrentDayIndex(step);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isSimulating]);

  // Chart Data Construction
  const chartData = useMemo(() => {
    if (!isSimulating && !simulationComplete) return [];
    const visiblePaths = allPathsRef.current;
    const data = [];
    const stepSize = Math.max(1, Math.floor(currentDayIndex / 100));

    for (let d = 0; d < currentDayIndex; d += stepSize) {
      const point: any = { day: d };
      visiblePaths.forEach((path, i) => {
        point[`sim${i}`] = path[d];
      });
      data.push(point);
    }
    return data;
  }, [currentDayIndex, isSimulating, simulationComplete]);

  // Cone Data
  const coneChartData = useMemo(() => {
    if (!simulationComplete || !coneRef.current) return [];
    const { median, p05, p95 } = coneRef.current;
    return median.map((m: number, i: number) => {
      return {
        day: i * STATS_STEP_DAYS,
        median: m,
        p05: p05[i],
        p95: p95[i],
        interval: Math.max(0, p95[i] - p05[i]),
      };
    });
  }, [simulationComplete]);

  const riskMetrics = useMemo(() => {
    if (
      !simulationComplete ||
      !statsFinalRef.current.length ||
      !coneChartData.length
    )
      return null;
    const finalValues = statsFinalRef.current;

    const medianOutcome = calculateQuantile(finalValues, 0.5);
    const p05Outcome = calculateQuantile(finalValues, 0.05);
    const p95Outcome = calculateQuantile(finalValues, 0.95);

    return {
      medianOutcome,
      p05Outcome,
      p95Outcome,
      modeledLossAtP05: initialInvestment - p05Outcome,
    };
  }, [simulationComplete, initialInvestment, coneChartData]);

  // Calculate the annualized rate implied by the median modeled outcome.
  const medianCAGR = useMemo(() => {
    if (!riskMetrics || initialInvestment <= 0) return 0;
    return (
      Math.pow(
        riskMetrics.medianOutcome / initialInvestment,
        1 / timeHorizonYears,
      ) - 1
    );
  }, [riskMetrics, initialInvestment, timeHorizonYears]);

  // Percentage Growth Calculation
  const percentageGrowth = useMemo(() => {
    if (!riskMetrics || initialInvestment <= 0) return 0;
    return (
      ((riskMetrics.medianOutcome - initialInvestment) / initialInvestment) *
      100
    );
  }, [riskMetrics, initialInvestment]);

  const horizonOptions = HORIZONS.includes(timeHorizonYears as (typeof HORIZONS)[number])
    ? HORIZONS
    : ([...HORIZONS, timeHorizonYears].sort((a, b) => a - b) as number[]);
  const showResult = simulationComplete && riskMetrics;
  const lostAtLow = riskMetrics ? riskMetrics.p05Outcome < initialInvestment : false;
  const chip = "ws-chip";

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
              See a range of ways your portfolio could grow, built from how its holdings have moved together in the past. It shows {numSimulations} possible paths, not a prediction.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {simulationComplete && riskMetrics && (
            <PortfolioShareButton
              portfolio={portfolio}
              metrics={{
                totalValue: currentPortfolioValue,
                annualReturn: medianCAGR,
                yield: null,
                projectedValue: riskMetrics.medianOutcome,
                totalInvested: initialInvestment,
                dividends: null,
                years: timeHorizonYears,
                scenario: "Monte Carlo Median",
                growthType: "Monte Carlo",
                percentageGrowth: percentageGrowth,
              }}
              history={coneChartData.map(
                (d: {
                  median: number;
                  p05: number;
                  p95: number;
                  day: number;
                }) => ({
                  value: d.median,
                  min: d.p05,
                  max: d.p95,
                  date: `Y${(d.day / 252).toFixed(1)}`,
                }),
              )}
            />
          )}

          {!isSimulating && (
            <button
              onClick={prepareSimulation}
              disabled={isLoadingHistory}
              className="ws-pill ws-pill-primary h-11 whitespace-nowrap px-6 md:h-10"
            >
              {isLoadingHistory ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : simulationComplete ? (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
              {isLoadingHistory
                ? "Loading data..."
                : simulationComplete
                  ? "Run again"
                  : "Run simulation"}
            </button>
          )}
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
              onChange={(e) => setInitialInvestment(Number(e.target.value))}
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

      <p className="max-w-3xl text-sm leading-6 text-muted">
        Illustrative scenarios, not forecasts or calibrated probabilities. Each simulated step applies a random daily return using the historical average, volatility, and co-movement between holdings. Historical returns are total returns (distributions reinvested) when every holding has dividend-adjusted closes, and price returns otherwise; the model details panel says which. It assumes a buy-and-hold portfolio. Recurring contributions, withdrawals, rebalancing, fees, taxes, and extreme events are excluded.
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

      {/* Answer first */}
      <AnimatePresence>
        {showResult && riskMetrics && (
          <motion.section
            aria-label="Simulation result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] @3xl:items-end"
          >
            <div>
              <p className="text-sm text-muted">
                In {timeHorizonYears} {timeHorizonYears === 1 ? "year" : "years"}, a typical path ends near
              </p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-ink @2xl:text-5xl">
                {formatCurrency(riskMetrics.medianOutcome, currency)}
              </p>
              <p className="mt-2 text-sm text-body">
                <span className={percentageGrowth >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {signedPercent(percentageGrowth)}
                </span>{" "}
                from {formatCurrency(initialInvestment, currency)}, or about{" "}
                <span className={medianCAGR >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {signedPercent(medianCAGR * 100)}
                </span>{" "}
                a year. Half of the simulated paths finished higher and half lower.
              </p>
              {modelStats && (
                <p className="mt-2 text-sm text-muted">
                  The paths assume the average return of {modelStats.lookbackStart} to {modelStats.lookbackEnd} repeats
                  every year. From {modelStats.observationCount} days of history, that average is only known to within
                  about ±{(196 * modelStats.annualizedVolatility / Math.sqrt(modelStats.observationCount / 252)).toFixed(0)}{" "}
                  points a year (95% interval), so the middle path mostly reflects how that period went.
                </p>
              )}
            </div>

            <dl className="divide-y divide-hairline rounded-lg ring-1 ring-hairline">
              {[
                ["Stronger end", `1 in 20 of ${STATS_PATHS.toLocaleString()} modelled paths finished above`, riskMetrics.p95Outcome],
                ["Typical", "The middle path", riskMetrics.medianOutcome],
                ["Weaker end", `1 in 20 of ${STATS_PATHS.toLocaleString()} modelled paths finished below`, riskMetrics.p05Outcome],
              ].map(([label, note, value]) => (
                <div key={label as string} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <dt className="text-sm font-medium text-ink">{label}</dt>
                    <dd className="text-sm text-muted">{note}</dd>
                  </div>
                  <dd className="text-lg font-semibold tabular-nums text-ink">{formatCurrency(value as number, currency)}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-body @3xl:col-span-2">
              {lostAtLow
                ? `In the weaker end of these paths, the balance finished ${formatCurrency(riskMetrics.modeledLossAtP05, currency)} below where it started. Losses of this size are possible, and larger ones are too.`
                : "Even in the weaker end of these paths, the balance finished above where it started. That is a feature of this sample, not a promise."}
            </p>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Chart */}
      {(!error || simulationComplete) && (
        <div
          className={cn(
            "ws-panel relative overflow-hidden p-4 @2xl:p-6",
            isSimulating || simulationComplete ? "min-h-[340px] flex-1" : "",
          )}
        >
          {!isSimulating && !simulationComplete && !error && !isLoadingHistory && (
            <div className="flex flex-col items-start gap-1 py-6">
              <p className="text-base font-medium text-ink">Your range of outcomes will appear here</p>
              <p className="text-sm text-muted">Press Run simulation to draw {numSimulations} possible paths over {timeHorizonYears} years.</p>
            </div>
          )}

          {isSimulating && (
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--hairline)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    type="number"
                    domain={[0, timeHorizonYears * 252]}
                    ticks={yearTicks(timeHorizonYears)}
                    tickFormatter={(d) => `${Math.round(d / 252)}y`}
                    tick={{ fill: "var(--muted)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted)", fontSize: 12 }}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => compactMoney(v, currency)}
                    width={64}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ReferenceLine y={initialInvestment} stroke="var(--hairline-strong)" strokeDasharray="4 4" />
                  {Array.from({ length: numSimulations }).map((_, i) => (
                    <Line
                      key={i}
                      type="monotone"
                      dataKey={`sim${i}`}
                      stroke="var(--ink)"
                      strokeWidth={1}
                      strokeOpacity={0.18}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {simulationComplete && !isSimulating && (
            <motion.figure
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="m-0"
            >
              <figcaption className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-body">
                <span className="inline-flex items-center gap-2">
                  <span className="h-0.5 w-5 rounded bg-ink" aria-hidden="true" /> Typical path
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-5 rounded-sm bg-ink/15" aria-hidden="true" /> Where 9 in 10 paths finished
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-5 border-t border-dashed border-muted" aria-hidden="true" /> Starting amount
                </span>
              </figcaption>
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={coneChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--hairline)" vertical={false} />
                    <XAxis
                      dataKey="day"
                      type="number"
                      domain={[0, timeHorizonYears * 252]}
                      ticks={yearTicks(timeHorizonYears)}
                      tickFormatter={(d) => `${Math.round(d / 252)}y`}
                      tick={{ fill: "var(--muted)", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "var(--muted)", fontSize: 12 }}
                      tickFormatter={(v) => compactMoney(v, currency)}
                      width={64}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ReferenceLine y={initialInvestment} stroke="var(--muted)" strokeDasharray="4 4" />
                    <Tooltip
                      cursor={{ stroke: "var(--hairline-strong)" }}
                      content={({ active, payload }) => {
                        const d = active && payload?.length ? (payload[0].payload as { day: number; median: number; p05: number; p95: number }) : null;
                        if (!d) return null;
                        return (
                          <div className="ws-floating min-w-48 p-3 text-sm">
                            <p className="mb-2 font-medium text-ink">Year {(d.day / 252).toFixed(1)}</p>
                            <p className="flex justify-between gap-6 text-muted">Stronger end <span className="tabular-nums text-ink">{formatCurrency(d.p95, currency)}</span></p>
                            <p className="flex justify-between gap-6 text-muted">Typical <span className="tabular-nums text-ink">{formatCurrency(d.median, currency)}</span></p>
                            <p className="flex justify-between gap-6 text-muted">Weaker end <span className="tabular-nums text-ink">{formatCurrency(d.p05, currency)}</span></p>
                          </div>
                        );
                      }}
                    />
                    {/* Lower edge of the simulated 5th to 95th percentile range, left unfilled. */}
                    <Area type="monotone" dataKey="p05" stackId="interval" name="5th Percentile" stroke="none" fill="transparent" fillOpacity={0} isAnimationActive={false} />
                    <Area
                      type="monotone"
                      dataKey="interval"
                      stackId="interval"
                      name="Illustrative 5th–95th percentile range"
                      stroke="none"
                      fill="var(--ink)"
                      fillOpacity={0.15}
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                    <Line type="monotone" dataKey="p95" name="Illustrative 95th percentile" stroke="var(--ink)" strokeOpacity={0.35} strokeWidth={1} dot={false} animationDuration={900} />
                    <Line type="monotone" dataKey="p05" name="Illustrative 5th percentile" stroke="var(--ink)" strokeOpacity={0.35} strokeWidth={1} dot={false} animationDuration={900} />
                    <Area type="monotone" dataKey="median" name="Illustrative median" stroke="var(--ink)" strokeWidth={2.5} fill="none" animationDuration={1000} animationEasing="ease-out" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.figure>
          )}
        </div>
      )}

      {simulationComplete && modelStats && (
        <details className="rounded-lg ring-1 ring-hairline">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-compass">
            What this simulation used
          </summary>
          <dl className="grid gap-x-8 gap-y-3 px-4 pb-4 text-sm @xl:grid-cols-2">
            <div>
              <dt className="text-muted">Historical annualized log drift</dt>
              <dd className="font-medium tabular-nums text-ink">{(modelStats.annualizedLogDrift * 100).toFixed(2)}%</dd>
            </div>
            <div>
              <dt className="text-muted">Historical annualized volatility</dt>
              <dd className="font-medium tabular-nums text-ink">{(modelStats.annualizedVolatility * 100).toFixed(2)}%</dd>
            </div>
            <div>
              <dt className="text-muted">Historical covariance model</dt>
              <dd className="font-medium text-ink">Historical sample</dd>
            </div>
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
        </details>
      )}

      {/* Explainer Section */}
      <div className="pb-12">
        <SimulatorExplainer mode="MONTE_CARLO" />
      </div>
    </div>
  );
}
