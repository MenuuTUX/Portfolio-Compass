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
  Info,
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
  hasDailyObservationCoverage,
} from "@/lib/math/history";
import { convertPriceHistoryToCad, type HistoricalFxRate } from "@/lib/math/fx-history";
import { getPortfolioValuation, type BankOfCanadaFxRate } from "@/lib/math/portfolio-returns";
import { PortfolioShareButton } from "../PortfolioShareButton";
import SimulatorExplainer from "./SimulatorExplainer";

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
}

function hasDailyHistory(points: Portfolio[0]["history"]): boolean {
  return !!points && points.length >= 200 &&
    hasDailyObservationCoverage(points.map((point) => point.date));
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

  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [modelStats, setModelStats] = useState<SimulationModelStats | null>(
    null,
  );

  // Animation Ref
  const animationFrameRef = useRef<number>(0);
  const allPathsRef = useRef<number[][]>([]);
  const coneRef = useRef<any>(null);

  // Effect to sync initialInvestment with portfolio value if it loads later and we are at default
  useEffect(() => {
    if (currentPortfolioValue > 0) {
      setInitialInvestment(currentPortfolioValue);
    }
  }, [currentPortfolioValue]);

  // Load full history if needed
  const ensureFullHistory = useCallback(async (): Promise<Portfolio | null> => {
    const heldPortfolio = portfolio.filter((item) => item.shares > 0);
    const needsFetch = heldPortfolio.some((item) => !hasDailyHistory(item.history));

    let historyPortfolio = heldPortfolio;
    if (needsFetch) {
      setIsLoadingHistory(true);
      setError(null);

      try {
        const tickers = heldPortfolio.map((p) => p.ticker).join(",");
        const res = await fetch(
          `/api/market/chart?tickers=${encodeURIComponent(tickers)}&range=1Y`,
        );
        if (!res.ok) throw new Error("Failed to fetch historical data");

        const { series } = await res.json();

        historyPortfolio = heldPortfolio.map((item) => {
          const points = series?.[item.ticker.toUpperCase()];
          return points?.length ? { ...item, history: points } : item;
        });
      } catch (e: any) {
        setError(`Error loading data: ${e.message}`);
        setIsLoadingHistory(false);
        return null;
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

    setModelStats({
      annualizedLogDrift: sampleMean * 252,
      annualizedVolatility: Math.sqrt(sampleVariance * 252),
      observationCount,
      lookbackStart: dates[0],
      lookbackEnd: dates[dates.length - 1],
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
    );

    allPathsRef.current = paths;
    coneRef.current = calculateCone(paths);
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
        day: i,
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
      !allPathsRef.current.length ||
      !coneChartData.length
    )
      return null;
    const finalValues = allPathsRef.current.map((p) => p[p.length - 1]);

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

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-surface-soft text-neutral-400 hover:text-ink transition-colors"
              title="Back to Portfolio"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-ink flex items-center gap-2">
              Monte Carlo Simulation{" "}
              <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                BETA
              </span>
            </h2>
            <p className="text-sm text-neutral-400">
              Runs {numSimulations} illustrative paths from observed daily price returns, volatility, and correlations. Results depend on this historical sample and the assumptions below.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors shadow-lg shadow-emerald-900/20"
            >
              {isLoadingHistory ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : simulationComplete ? (
                <RefreshCw className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
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

      {/* Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl bg-surface-card border border-hairline">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-neutral-400 uppercase tracking-wider font-semibold block">
              Investment
            </label>
            {currentPortfolioValue > 0 &&
              initialInvestment !== currentPortfolioValue && (
                <button
                  onClick={() => setInitialInvestment(currentPortfolioValue)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  title="Reset to current portfolio value"
                >
                  <RefreshCw className="w-3 h-3" />
                  Sync
                </button>
              )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">$</span>
            <input
              type="number"
              aria-label={`Starting balance (${currency ?? "currency"})`}
              value={initialInvestment}
              onChange={(e) => setInitialInvestment(Number(e.target.value))}
              className="bg-transparent text-xl font-mono text-ink focus:outline-none w-full"
            />
          </div>
        </div>
        <div className="glass-panel p-4 rounded-xl bg-surface-card border border-hairline">
          <label className="text-xs text-neutral-400 uppercase tracking-wider font-semibold mb-2 block">
            Time Horizon
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="30"
              value={timeHorizonYears}
              onChange={(e) => setTimeHorizonYears(Number(e.target.value))}
              className="flex-1 accent-emerald-500"
            />
            <span className="text-xl font-mono text-ink w-12 text-right">
              {timeHorizonYears}y
            </span>
          </div>
        </div>
        <div className="glass-panel p-4 rounded-xl bg-surface-card border border-hairline">
          <label className="text-xs text-neutral-400 uppercase tracking-wider font-semibold mb-2 block">
            Simulations
          </label>
          <select
            value={numSimulations}
            onChange={(e) => setNumSimulations(Number(e.target.value))}
            className="bg-black/50 border border-hairline text-ink rounded px-2 py-1 w-full focus:outline-none"
          >
            <option value={20}>20 paths</option>
            <option value={50}>50 paths</option>
            <option value={100}>100 paths</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-neutral-500 leading-relaxed">
        Illustrative price-only scenarios, not forecasts or calibrated probabilities. Each simulated step applies a random daily price return using the historical average, volatility, and co-movement between holdings. It assumes a buy-and-hold portfolio. Recurring contributions, withdrawals, rebalancing, distributions, fees, and extreme events are excluded.
      </p>
      {mixedCurrency && fxProvenance && (
        <p className="text-xs text-neutral-500">
          Historical USD/CAD moves are included in the converted CAD return samples. Current USD quotes use {fxProvenance.usdCad} CAD/USD ({fxProvenance.date}); future FX is not modeled as a separate process or forecast.
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {simulationComplete && modelStats && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-hairline bg-hairline text-xs text-muted sm:grid-cols-3">
          <div className="bg-surface-card px-3 py-2">
              <span className="block">Historical annualized log drift</span>
            <strong className="mt-1 block font-mono text-sm text-ink">
              {(modelStats.annualizedLogDrift * 100).toFixed(2)}%
            </strong>
          </div>
          <div className="bg-surface-card px-3 py-2">
              <span className="block">Historical annualized volatility</span>
            <strong className="mt-1 block font-mono text-sm text-ink">
              {(modelStats.annualizedVolatility * 100).toFixed(2)}%
            </strong>
          </div>
          <div className="bg-surface-card px-3 py-2">
            <span className="block">Historical covariance model</span>
            <strong className="mt-1 block font-mono text-sm text-ink">
              Historical sample
            </strong>
          </div>
          <div className="bg-surface-card px-3 py-2">
            <span className="block">Aligned daily returns</span>
            <strong className="mt-1 block font-mono text-sm text-ink">
              {modelStats.observationCount}
            </strong>
          </div>
          <div className="bg-surface-card px-3 py-2 sm:col-span-3">
            <span className="block">Observed lookback</span>
            <strong className="mt-1 block font-mono text-sm text-ink">
              {modelStats.lookbackStart} to {modelStats.lookbackEnd} · daily closes · price returns only
            </strong>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-[400px] glass-panel p-6 rounded-xl bg-dune/30 border border-hairline relative overflow-hidden">
        {!isSimulating &&
          !simulationComplete &&
          !error &&
          !isLoadingHistory && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 z-10">
              <Info className="w-12 h-12 mb-4 opacity-50" />
              <p>Run the simulation to generate model paths.</p>
            </div>
          )}

        {(isSimulating || (simulationComplete && false)) && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#333"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                stroke="#555"
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                tickFormatter={(d) => `Y${Math.floor(d / 252)}`}
                type="number"
                domain={[0, timeHorizonYears * 252]}
              />
              <YAxis
                stroke="#555"
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                domain={["auto", "auto"]}
                tickFormatter={(v) => `${currency} ${(v / 1000).toFixed(0)}k`}
              />
              <ReferenceLine
                y={initialInvestment}
                stroke="#8f9b94"
                strokeDasharray="4 4"
              />
              {Array.from({ length: numSimulations }).map((_, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`sim${i}`}
                  stroke="#ef4444"
                  strokeWidth={1}
                  strokeOpacity={0.3}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        {simulationComplete && !isSimulating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full h-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={coneChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#333"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  stroke="#555"
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  tickFormatter={(d) => `Y${Math.floor(d / 252)}`}
                  minTickGap={30}
                  label={{
                    value: "Trading days",
                    position: "insideBottom",
                    offset: -4,
                    fill: "#666",
                    fontSize: 12,
                  }}
                />
                <YAxis
                  stroke="#555"
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  tickFormatter={(value) => {
                    if (value >= 1000000)
                      return `$${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                    return `$${value}`;
                  }}
                  width={60}
                  label={{
                    value: currency ?? "Currency unavailable",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#666",
                    fontSize: 12,
                  }}
                />
                <ReferenceLine
                  y={initialInvestment}
                  stroke="var(--muted)"
                  strokeDasharray="4 4"
                  label={{
                    value: "Initial",
                    fill: "#737373",
                    fontSize: 12,
                    position: "insideTopLeft",
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-card)",
                    borderColor: "var(--hairline)",
                    color: "var(--ink)",
                  }}
                  itemStyle={{ color: "var(--ink)" }}
                  formatter={(val: any) => formatCurrency(Number(val), currency)}
                  labelFormatter={(d) => `Year ${(d / 252).toFixed(1)}`}
                />
                {/* Lower edge of the simulated percentile range. */}
                <Area
                  type="monotone"
                  dataKey="p05"
                  stackId="interval"
                  name="5th Percentile"
                  stroke="none"
                  fill="transparent"
                  fillOpacity={0}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="interval"
                  stackId="interval"
                  name="Illustrative 5th–95th percentile range"
                  stroke="none"
                  fill="#10b981"
                  fillOpacity={1}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="p95"
                  name="Illustrative 95th percentile"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="median"
                  name="Illustrative median"
                  stroke="#10b981"
                  strokeWidth={3}
                  fill="none"
                />
                <Line
                  type="monotone"
                  dataKey="p05"
                  name="Illustrative 5th percentile"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>

      {/* Results */}
      <AnimatePresence>
        {simulationComplete && riskMetrics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4"
          >
            <div className="glass-card p-4 rounded-xl border-l-4 border-emerald-500 bg-surface-card">
              <div className="text-xs text-neutral-400">Median</div>
              <div className="text-xl font-bold text-ink">
                {formatCurrency(riskMetrics.medianOutcome, currency)}
              </div>
            </div>
            <div className="glass-card p-4 rounded-xl border-l-4 border-emerald-300 bg-surface-card">
              <div className="text-xs text-neutral-400">95th Percentile</div>
              <div className="text-lg font-bold text-emerald-300">
                {formatCurrency(riskMetrics.p95Outcome, currency)}
              </div>
            </div>
            <div className="glass-card p-4 rounded-xl border-l-4 border-rose-500 bg-surface-card">
              <div className="text-xs text-neutral-400">5th Percentile</div>
              <div className="text-lg font-bold text-rose-400">
                {formatCurrency(riskMetrics.p05Outcome, currency)}
              </div>
            </div>
            <div className="glass-card p-4 rounded-xl border-l-4 border-yellow-500 bg-surface-card">
              <div className="text-xs text-neutral-400">
                Modeled Loss at 5th Percentile
              </div>
              <div className="text-lg font-bold text-yellow-400">
                {formatCurrency(
                  riskMetrics.modeledLossAtP05 > 0
                    ? riskMetrics.modeledLossAtP05
                    : 0,
                  currency,
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explainer Section */}
      <div className="pb-12">
        <SimulatorExplainer mode="MONTE_CARLO" />
      </div>
    </div>
  );
}
