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
} from "recharts";
import { cn, formatCurrency } from "@/lib/utils";
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
} from "@/lib/monte-carlo";
import {
  getEffectiveWeights,
  getAssetYieldFraction,
  getPortfolioMarketValue,
  getPortfolioDividendYield,
  annualYieldToDailyLogDrift,
  estimateAssetTotalReturn,
} from "@/lib/math/portfolio-returns";
import { PortfolioShareButton } from "../PortfolioShareButton";
import SimulatorExplainer from "./SimulatorExplainer";

interface MonteCarloSimulatorProps {
  portfolio: Portfolio;
  onBack?: () => void;
}

export default function MonteCarloSimulator({
  portfolio,
  onBack,
}: MonteCarloSimulatorProps) {
  // Market value across *all* holdings
  const currentPortfolioValue = useMemo(
    () => getPortfolioMarketValue(portfolio),
    [portfolio],
  );

  // State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationComplete, setSimulationComplete] = useState(false);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [numSimulations, setNumSimulations] = useState(50);
  const [timeHorizonYears, setTimeHorizonYears] = useState(10);

  // Initialize with portfolio value if > 0, else 10000
  const [initialInvestment, setInitialInvestment] = useState<number>(
    currentPortfolioValue || 10000,
  );

  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [richPortfolio, setRichPortfolio] = useState<Portfolio>(portfolio);
  const [analyticSharpe, setAnalyticSharpe] = useState<number>(0);
  const [weightedYield, setWeightedYield] = useState<number>(0);

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
    // Check if we have enough history (e.g. > 100 points) for all items
    const needsFetch = portfolio.some(
      (item) => !item.history || item.history.length < 200,
    );

    if (!needsFetch) {
      setRichPortfolio(portfolio);
      return portfolio;
    }

    setIsLoadingHistory(true);
    setError(null);

    try {
      const tickers = portfolio.map((p) => p.ticker).join(",");
      const res = await fetch(
        `/api/market/chart?tickers=${encodeURIComponent(tickers)}&range=1Y`,
      );
      if (!res.ok) throw new Error("Failed to fetch historical data");

      const { series } = await res.json();

      const newPortfolio = portfolio.map((item) => {
        const points = series?.[item.ticker.toUpperCase()];
        if (points && points.length > 0) {
          return { ...item, history: points };
        }
        return item;
      });

      setRichPortfolio(newPortfolio);
      setIsLoadingHistory(false);
      return newPortfolio;
    } catch (e: any) {
      setError(`Error loading data: ${e.message}`);
      setIsLoadingHistory(false);
      return null;
    }
  }, [portfolio]);

  // Prepare data for every portfolio asset.
  const prepareSimulation = useCallback(async () => {
    if (portfolio.length === 0) {
      setError("Portfolio is empty.");
      return;
    }

    const fetchedPortfolio = await ensureFullHistory();
    if (!fetchedPortfolio) return;

    setError(null);
    setSimulationComplete(false);
    setCurrentDayIndex(0);

    const activePortfolio = fetchedPortfolio;
    const n = activePortfolio.length;
    // Value-based weights preferred; falls back to explicit weights / equal
    const weights = getEffectiveWeights(activePortfolio);

    // Assets with enough price history for empirical returns
    const HISTORY_MIN = 30;
    const hasHistory = activePortfolio.map(
      (item) => !!(item.history && item.history.length >= HISTORY_MIN),
    );
    const historyIndices = hasHistory
      .map((ok, i) => (ok ? i : -1))
      .filter((i) => i >= 0);
    const noHistoryIndices = hasHistory
      .map((ok, i) => (!ok ? i : -1))
      .filter((i) => i >= 0);

    if (noHistoryIndices.length > 0) {
      const names = noHistoryIndices
        .map((i) => activePortfolio[i].ticker)
        .join(", ");
      // These assets still enter the model through yield and heuristic drift.
      setError(
        `Note: ${names} lack price history; using yield + heuristic drift so they still count.`,
      );
    }

    // Align overlapping history among assets that have it
    let meanPriceLog: number[] = new Array(n).fill(0);
    let covMatrix: number[][] = Array.from({ length: n }, () =>
      Array(n).fill(0),
    );

    if (historyIndices.length > 0) {
      const histItems = historyIndices.map((i) => activePortfolio[i]);
      const startDates = histItems.map((item) =>
        new Date(item.history[0].date).getTime(),
      );
      const latestStartDate = Math.max(...startDates);

      const alignedPrices: number[][] = [];
      histItems.forEach((item) => {
        const filtered = item.history.filter(
          (h) => new Date(h.date).getTime() >= latestStartDate,
        );
        alignedPrices.push(filtered.map((h) => h.price));
      });

      const minLen = Math.min(...alignedPrices.map((arr) => arr.length));
      if (minLen < HISTORY_MIN && historyIndices.length === n) {
        // Every asset has history but overlap is too short
        const limitingItem = histItems.reduce((a, b) =>
          new Date(a.history[0].date) > new Date(b.history[0].date) ? a : b,
        );
        const startDate = new Date(
          limitingItem.history[0].date,
        ).toLocaleDateString();
        setError(
          `Portfolio overlap is too short (${minLen} days). Limited by ${limitingItem.ticker} (Starts ${startDate}).`,
        );
        return;
      }

      if (minLen >= 2) {
        const finalPrices = alignedPrices.map((arr) =>
          arr.slice(arr.length - minLen),
        );
        const returnsMatrix = finalPrices.map((prices) =>
          calculateLogReturns(prices),
        );

        // Empirical price log-means for history assets
        historyIndices.forEach((pi, localIdx) => {
          const rets = returnsMatrix[localIdx];
          meanPriceLog[pi] =
            rets.reduce((a, b) => a + b, 0) / Math.max(1, rets.length);
        });

        // Empirical covariance among history assets
        try {
          const histCov = calculateCovarianceMatrix(returnsMatrix);
          for (let i = 0; i < historyIndices.length; i++) {
            for (let j = 0; j < historyIndices.length; j++) {
              covMatrix[historyIndices[i]][historyIndices[j]] = histCov[i][j];
            }
          }
        } catch (e: any) {
          setError("Math Error: " + e.message);
          return;
        }
      }
    }

    // Use the median daily variance of assets with history as fallback volatility.
    const histVars = historyIndices
      .map((i) => covMatrix[i][i])
      .filter((v) => v > 0);
    const medianVar =
      histVars.length > 0
        ? histVars.sort((a, b) => a - b)[Math.floor(histVars.length / 2)]
        : (0.15 * 0.15) / 252; // ~15% ann. vol default

    // Assets without history: heuristic total return → price log-mean
    // (yield is added separately below for every asset)
    noHistoryIndices.forEach((i) => {
      const totalAnn = estimateAssetTotalReturn(activePortfolio[i]);
      const yieldAnn = getAssetYieldFraction(activePortfolio[i]);
      // Price component of heuristic (avoid double-counting yield later)
      const priceAnn = Math.max(0, totalAnn - yieldAnn);
      meanPriceLog[i] = Math.log(1 + priceAnn) / 252;
      covMatrix[i][i] = medianVar; // uncorrelated with others
    });

    // Ensure every diagonal is positive (needed for Cholesky)
    for (let i = 0; i < n; i++) {
      if (!(covMatrix[i][i] > 1e-12)) {
        covMatrix[i][i] = medianVar;
      }
    }

    // Total-return daily drift = price log-mean + dividend log-drift
    // (history uses unadjusted closes, so yield must be added explicitly)
    const meanReturns = activePortfolio.map((item, i) => {
      const divDrift = annualYieldToDailyLogDrift(getAssetYieldFraction(item));
      return meanPriceLog[i] + divDrift;
    });

    let cholesky: number[][];
    try {
      cholesky = getCholeskyDecomposition(covMatrix);
    } catch {
      // If cross-correlations make the matrix non-PD (e.g. after padding),
      // fall back to a diagonal Cholesky so the sim still runs for all assets.
      cholesky = Array.from({ length: n }, (_, i) => {
        const row = Array(n).fill(0);
        row[i] = Math.sqrt(Math.max(covMatrix[i][i], 1e-12));
        return row;
      });
      setError(
        "Note: correlations regularized (non-PD covariance); all assets still included.",
      );
    }

    // Guard: prices must be positive
    const currentPrices = activePortfolio.map((item) => {
      const p = Number(item.price);
      return p > 0 ? p : 1;
    });

    // Analytic Sharpe on total-return moments
    let expDailyRet = 0;
    for (let i = 0; i < n; i++) expDailyRet += weights[i] * meanReturns[i];

    let expDailyVar = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        expDailyVar += weights[i] * weights[j] * covMatrix[i][j];
      }
    }

    const annRet = Math.exp(expDailyRet * 252) - 1;
    const annVol = Math.sqrt(Math.max(0, expDailyVar)) * Math.sqrt(252);
    const riskFree = 0.04;
    setAnalyticSharpe(annVol > 0 ? (annRet - riskFree) / annVol : 0);

    // Dividend yield across ALL assets (for display / income chart)
    const calculatedYield = getPortfolioDividendYield(activePortfolio);
    setWeightedYield(calculatedYield);

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
    ensureFullHistory,
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
    const dailyYieldRate = weightedYield / 252;
    let accumulatedDividends = 0;

    return median.map((m: number, i: number) => {
      // Calculate accumulated dividends for this step based on median value
      if (i > 0) {
        accumulatedDividends += m * dailyYieldRate;
      }

      return {
        day: i,
        median: m,
        p05: p05[i],
        p95: p95[i],
        dividends: accumulatedDividends,
      };
    });
  }, [simulationComplete, weightedYield]);

  // SPY Comparison Data (Deterministic for Share Card)
  const spyData = useMemo(() => {
    if (!simulationComplete) return [];
    const spyAnnualRet = 0.1; // 10%
    const dailyRate = Math.pow(1 + spyAnnualRet, 1 / 252) - 1;

    // Generate same length as cone data
    const days = coneChartData.length;
    const data = [];
    let val = initialInvestment;
    for (let i = 0; i < days; i++) {
      data.push({ value: val });
      val *= 1 + dailyRate;
    }
    return data;
  }, [simulationComplete, coneChartData, initialInvestment]);

  const riskMetrics = useMemo(() => {
    if (
      !simulationComplete ||
      !allPathsRef.current.length ||
      !coneChartData.length
    )
      return null;
    const finalValues = allPathsRef.current.map((p) => p[p.length - 1]);
    finalValues.sort((a, b) => a - b);

    const totalDividends =
      coneChartData[coneChartData.length - 1]?.dividends || 0;

    return {
      medianOutcome: finalValues[Math.floor(finalValues.length * 0.5)],
      p05Outcome: finalValues[Math.floor(finalValues.length * 0.05)],
      p95Outcome: finalValues[Math.floor(finalValues.length * 0.95)],
      modeledLossAtP05:
        initialInvestment - finalValues[Math.floor(finalValues.length * 0.05)],
      totalDividends,
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
              Generate {numSimulations} model paths from estimated return,
              volatility, and covariance.
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
                yield: weightedYield,
                projectedValue: riskMetrics.medianOutcome,
                totalInvested: initialInvestment,
                dividends: riskMetrics.totalDividends,
                years: timeHorizonYears,
                scenario: "Monte Carlo Median",
                growthType: "Monte Carlo",
                percentageGrowth: percentageGrowth,
              }}
              history={coneChartData.map(
                (d: {
                  median: number;
                  dividends: number;
                  p05: number;
                  p95: number;
                  day: number;
                }) => ({
                  value: d.median,
                  dividendValue: d.dividends,
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
        These are model scenarios, not forecasts. Results depend on historical
        estimates and geometric Brownian motion, which may not capture sudden
        market shifts or extreme events.
      </p>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
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
                tickFormatter={(d) => `Y${Math.floor(d / 252)}`}
                type="number"
                domain={[0, timeHorizonYears * 252]}
              />
              <YAxis
                stroke="#555"
                domain={["auto", "auto"]}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              {Array.from({ length: numSimulations }).map((_, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`sim${i}`}
                  stroke="#10b981"
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
                <defs>
                  <linearGradient id="coneGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#333"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  stroke="#555"
                  tickFormatter={(d) => `Y${Math.floor(d / 252)}`}
                  minTickGap={30}
                />
                <YAxis
                  stroke="#555"
                  tickFormatter={(value) => {
                    if (value >= 1000000)
                      return `$${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                    return `$${value}`;
                  }}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-card)",
                    borderColor: "var(--hairline)",
                    color: "var(--ink)",
                  }}
                  itemStyle={{ color: "var(--ink)" }}
                  formatter={(val: any) => formatCurrency(Number(val))}
                  labelFormatter={(d) => `Year ${(d / 252).toFixed(1)}`}
                />
                {/* 95th percentile */}
                <Area
                  type="monotone"
                  dataKey="p95"
                  name="95th Percentile"
                  stroke="#34d399"
                  strokeWidth={2}
                  fill="url(#coneGradient)"
                  fillOpacity={1}
                />
                {/* Median */}
                <Area
                  type="monotone"
                  dataKey="median"
                  name="Median"
                  stroke="#10b981"
                  strokeWidth={3}
                  fill="none"
                />
                {/* 5th percentile */}
                <Area
                  type="monotone"
                  dataKey="p05"
                  name="5th Percentile"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="none"
                />
                {/* Estimated accumulated dividends */}
                <Area
                  type="monotone"
                  dataKey="dividends"
                  name="Estimated Accumulated Dividends"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  fill="none"
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
                {formatCurrency(riskMetrics.medianOutcome)}
              </div>
            </div>
            <div className="glass-card p-4 rounded-xl border-l-4 border-emerald-300 bg-surface-card">
              <div className="text-xs text-neutral-400">95th Percentile</div>
              <div className="text-lg font-bold text-emerald-300">
                {formatCurrency(riskMetrics.p95Outcome)}
              </div>
            </div>
            <div className="glass-card p-4 rounded-xl border-l-4 border-rose-500 bg-surface-card">
              <div className="text-xs text-neutral-400">5th Percentile</div>
              <div className="text-lg font-bold text-rose-400">
                {formatCurrency(riskMetrics.p05Outcome)}
              </div>
            </div>
            <div className="glass-card p-4 rounded-xl border-l-4 border-blue-500 bg-surface-card">
              <div className="text-xs text-neutral-400">
                Estimated Dividends
              </div>
              <div className="text-lg font-bold text-blue-400">
                {formatCurrency(riskMetrics.totalDividends)}
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
