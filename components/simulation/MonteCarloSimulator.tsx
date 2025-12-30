'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { cn, formatCurrency } from '@/lib/utils';
import { Portfolio, ETF } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, RefreshCw, AlertCircle, Info, Loader2 } from 'lucide-react';
import {
  calculateLogReturns,
  calculateCovarianceMatrix,
  getCholeskyDecomposition,
  generateMonteCarloPaths,
  calculateCone
} from '@/lib/monte-carlo';
import { Decimal } from 'decimal.js';
import { PortfolioShareButton } from '../PortfolioShareButton';

interface MonteCarloSimulatorProps {
  portfolio: Portfolio;
  onBack?: () => void;
}

export default function MonteCarloSimulator({ portfolio, onBack }: MonteCarloSimulatorProps) {
  // Calculate current portfolio value
  const currentPortfolioValue = useMemo(() => {
    return portfolio.reduce((sum, item) => {
      return sum + (item.price * (item.shares || 0));
    }, 0);
  }, [portfolio]);

  // State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationComplete, setSimulationComplete] = useState(false);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [numSimulations, setNumSimulations] = useState(50);
  const [timeHorizonYears, setTimeHorizonYears] = useState(10);

  // Initialize with portfolio value if > 0, else 10000
  const [initialInvestment, setInitialInvestment] = useState<number>(currentPortfolioValue || 10000);

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
      const needsFetch = portfolio.some(item => !item.history || item.history.length < 200);

      if (!needsFetch) {
          setRichPortfolio(portfolio);
          return portfolio;
      }

      setIsLoadingHistory(true);
      setError(null);

      try {
          const tickers = portfolio.map(p => p.ticker).join(',');
          // Request full history for the portfolio tickers
          const res = await fetch(`/api/etfs/search?tickers=${tickers}&full=true`);
          if (!res.ok) throw new Error("Failed to fetch historical data");

          const richEtfs: ETF[] = await res.json();

          // Merge rich data into portfolio
          const newPortfolio = portfolio.map(item => {
              const richItem = richEtfs.find(e => e.ticker === item.ticker);
              if (richItem) {
                  return { ...item, history: richItem.history };
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


  // 1. Prepare Data
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

    // Now proceed with `activePortfolio`
    const validItems = activePortfolio.filter(item => item.history && item.history.length > 30);
    if (validItems.length < activePortfolio.length) {
      setError("Some assets are missing historical data.");
      return;
    }

    // Align Dates
    const startDates = validItems.map(item => new Date(item.history[0].date).getTime());
    const latestStartDate = Math.max(...startDates);

    const alignedPrices: number[][] = [];
    validItems.forEach(item => {
        const filtered = item.history.filter(h => new Date(h.date).getTime() >= latestStartDate);
        alignedPrices.push(filtered.map(h => h.price));
    });

    const minLen = Math.min(...alignedPrices.map(arr => arr.length));
    if (minLen < 30) {
        setError("Not enough overlapping history (need > 30 days).");
        return;
    }
    const finalPrices = alignedPrices.map(arr => arr.slice(arr.length - minLen));

    const returnsMatrix = finalPrices.map(prices => calculateLogReturns(prices));
    const meanReturns = returnsMatrix.map(returns => {
        const sum = returns.reduce((a, b) => a + b, 0);
        return sum / returns.length;
    });

    let covMatrix: number[][];
    let cholesky: number[][];

    try {
        covMatrix = calculateCovarianceMatrix(returnsMatrix);
        cholesky = getCholeskyDecomposition(covMatrix);
    } catch (e: any) {
        setError("Math Error: " + e.message);
        return;
    }

    const currentPrices = validItems.map(item => item.price);
    const totalWeight = validItems.reduce((sum, item) => sum + item.weight, 0);
    const weights = validItems.map(item => item.weight / (totalWeight || 1));

    // Calculate Analytic Sharpe Ratio & Weighted Yield
    let expDailyRet = 0;
    for(let i=0; i<weights.length; i++) expDailyRet += weights[i] * meanReturns[i];

    let expDailyVar = 0;
    for(let i=0; i<weights.length; i++) {
        for(let j=0; j<weights.length; j++) {
            expDailyVar += weights[i] * weights[j] * covMatrix[i][j];
        }
    }

    const annRet = expDailyRet * 252;
    const annVol = Math.sqrt(expDailyVar) * Math.sqrt(252);
    const riskFree = 0.04;

    setAnalyticSharpe(annVol > 0 ? (annRet - riskFree) / annVol : 0);

    const calculatedYield = validItems.reduce((acc, item) => {
      const yieldVal = item.metrics?.yield || 0;
      return acc + ((yieldVal / 100) * (item.weight / totalWeight));
    }, 0);
    setWeightedYield(calculatedYield);


    const numDays = timeHorizonYears * 252;

    const paths = generateMonteCarloPaths(
        currentPrices,
        weights,
        meanReturns,
        cholesky,
        numSimulations,
        numDays,
        initialInvestment
    );

    allPathsRef.current = paths;
    coneRef.current = calculateCone(paths);
    setIsSimulating(true);

  }, [portfolio, numSimulations, timeHorizonYears, initialInvestment, richPortfolio]);

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
          visiblePaths.forEach((path, i) => { point[`sim${i}`] = path[d]; });
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
          dividends: accumulatedDividends
        };
      });
  }, [simulationComplete, weightedYield]);

  // SPY Comparison Data (Deterministic for Share Card)
  const spyData = useMemo(() => {
     if (!simulationComplete) return [];
     const spyAnnualRet = 0.10; // 10%
     const dailyRate = Math.pow(1 + spyAnnualRet, 1/252) - 1;

     // Generate same length as cone data
     const days = coneChartData.length;
     const data = [];
     let val = initialInvestment;
     for(let i=0; i<days; i++) {
        data.push({ value: val });
        val *= (1 + dailyRate);
     }
     return data;
  }, [simulationComplete, coneChartData, initialInvestment]);

  const riskMetrics = useMemo(() => {
      if (!simulationComplete || !allPathsRef.current.length || !coneChartData.length) return null;
      const finalValues = allPathsRef.current.map(p => p[p.length - 1]);
      finalValues.sort((a, b) => a - b);

      const totalDividends = coneChartData[coneChartData.length - 1]?.dividends || 0;

      return {
          medianOutcome: finalValues[Math.floor(finalValues.length * 0.5)],
          worst5Outcome: finalValues[Math.floor(finalValues.length * 0.05)],
          best5Outcome: finalValues[Math.floor(finalValues.length * 0.95)],
          vaR: initialInvestment - finalValues[Math.floor(finalValues.length * 0.05)],
          totalDividends
      };
  }, [simulationComplete, initialInvestment, coneChartData]);

  // Calculate CAGR from median outcome for accurate "Annual Return" display
  const medianCAGR = useMemo(() => {
      if (!riskMetrics || initialInvestment <= 0) return 0;
      return Math.pow(riskMetrics.medianOutcome / initialInvestment, 1 / timeHorizonYears) - 1;
  }, [riskMetrics, initialInvestment, timeHorizonYears]);

  // Percentage Growth Calculation
  const percentageGrowth = useMemo(() => {
      if (!riskMetrics || initialInvestment <= 0) return 0;
      return ((riskMetrics.medianOutcome - initialInvestment) / initialInvestment) * 100;
  }, [riskMetrics, initialInvestment]);

  return (
    <div className="h-full flex flex-col space-y-6">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            {onBack && (
                <button
                onClick={onBack}
                className="p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                title="Back to Portfolio"
                >
                <ArrowLeft className="w-6 h-6" />
                </button>
            )}
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    Monte Carlo Simulation <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">BETA</span>
                </h2>
                <p className="text-sm text-neutral-400">Simulate {numSimulations} potential market futures.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             {simulationComplete && riskMetrics && (
                <PortfolioShareButton
                    portfolio={portfolio}
                    metrics={{
                        totalValue: currentPortfolioValue,
                        annualReturn: medianCAGR, // Using accurate Median CAGR
                        yield: weightedYield,
                        projectedValue: riskMetrics.medianOutcome,
                        totalInvested: initialInvestment,
                        dividends: riskMetrics.totalDividends,
                        years: timeHorizonYears,
                        scenario: "Monte Carlo Median",
                        growthType: 'Monte Carlo',
                        percentageGrowth: percentageGrowth
                    }}
                    // PASSING RANGE DATA IMPLICITLY VIA MIN/MAX PROPS
                    chartData={coneChartData.map((d: { median: number, dividends: number, p05: number, p95: number }) => ({
                        value: d.median,
                        dividendValue: d.dividends,
                        min: d.p05, // Worst Case (5th percentile)
                        max: d.p95  // Best Case (95th percentile)
                    }))}
                    spyData={spyData}
                />
             )}

             {!isSimulating && (
                 <button
                    onClick={prepareSimulation}
                    disabled={isLoadingHistory}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors shadow-lg shadow-emerald-900/20"
                 >
                    {isLoadingHistory ? <Loader2 className="w-4 h-4 animate-spin" /> : (simulationComplete ? <RefreshCw className="w-4 h-4" /> : <Play className="w-4 h-4" />)}
                    {isLoadingHistory ? 'Loading Data...' : (simulationComplete ? 'Re-Run' : 'Run Simulation')}
                 </button>
             )}
          </div>
       </div>

       {/* Parameters */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <div className="glass-panel p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                 <label className="text-xs text-neutral-400 uppercase tracking-wider font-semibold block">Investment</label>
                 {currentPortfolioValue > 0 && initialInvestment !== currentPortfolioValue && (
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
                    className="bg-transparent text-xl font-mono text-white focus:outline-none w-full"
                 />
              </div>
           </div>
           <div className="glass-panel p-4 rounded-xl bg-white/5 border border-white/5">
              <label className="text-xs text-neutral-400 uppercase tracking-wider font-semibold mb-2 block">Time Horizon</label>
              <div className="flex items-center gap-2">
                 <input
                    type="range"
                    min="1" max="30"
                    value={timeHorizonYears}
                    onChange={(e) => setTimeHorizonYears(Number(e.target.value))}
                    className="flex-1 accent-emerald-500"
                 />
                 <span className="text-xl font-mono text-white w-12 text-right">{timeHorizonYears}y</span>
              </div>
           </div>
           <div className="glass-panel p-4 rounded-xl bg-white/5 border border-white/5">
              <label className="text-xs text-neutral-400 uppercase tracking-wider font-semibold mb-2 block">Simulations</label>
              <select
                value={numSimulations}
                onChange={(e) => setNumSimulations(Number(e.target.value))}
                className="bg-black/50 border border-white/10 text-white rounded px-2 py-1 w-full focus:outline-none"
              >
                <option value={20}>20 Paths (Fast)</option>
                <option value={50}>50 Paths (Balanced)</option>
                <option value={100}>100 Paths (Detailed)</option>
              </select>
           </div>
       </div>

       {/* Error */}
       {error && (
           <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 flex items-center gap-3">
               <AlertCircle className="w-5 h-5 shrink-0" />
               <p>{error}</p>
           </div>
       )}

       {/* Chart */}
       <div className="flex-1 min-h-[400px] glass-panel p-6 rounded-xl bg-black/40 border border-white/5 relative overflow-hidden">

           {!isSimulating && !simulationComplete && !error && !isLoadingHistory && (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 z-10">
                   <Info className="w-12 h-12 mb-4 opacity-50" />
                   <p>Click "Run Simulation" to generate future paths.</p>
               </div>
           )}

           {(isSimulating || (simulationComplete && false)) && (
               <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={chartData}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                       <XAxis dataKey="day" stroke="#555" tickFormatter={(d) => `Y${Math.floor(d/252)}`} type="number" domain={[0, timeHorizonYears * 252]} />
                       <YAxis stroke="#555" domain={['auto', 'auto']} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                       {Array.from({ length: numSimulations }).map((_, i) => (
                           <Line key={i} type="monotone" dataKey={`sim${i}`} stroke="#10b981" strokeWidth={1} strokeOpacity={0.3} dot={false} isAnimationActive={false} />
                       ))}
                   </LineChart>
               </ResponsiveContainer>
           )}

           {simulationComplete && !isSimulating && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full">
                   <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={coneChartData}>
                           <defs>
                                <linearGradient id="coneGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                                </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                       <XAxis
                          dataKey="day"
                          stroke="#555"
                          tickFormatter={(d) => `Y${Math.floor(d/252)}`}
                          minTickGap={30}
                       />
                       <YAxis
                          stroke="#555"
                          tickFormatter={(value) => {
                            if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                            if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                            return `$${value}`;
                          }}
                          width={60}
                       />
                           <Tooltip
                              contentStyle={{ backgroundColor: '#000', borderColor: '#333' }}
                              formatter={(val: any) => formatCurrency(Number(val))}
                              labelFormatter={(d) => `Year ${(d/252).toFixed(1)}`}
                           />
                       {/* 95th Percentile Area with explicit stroke for Best Case */}
                       <Area
                          type="monotone"
                          dataKey="p95"
                          name="Best Case (95th)"
                          stroke="#34d399"
                          strokeWidth={2}
                          fill="url(#coneGradient)"
                          fillOpacity={1}
                       />
                       {/* Median Line */}
                       <Area
                          type="monotone"
                          dataKey="median"
                          name="Median Outcome"
                          stroke="#10b981"
                          strokeWidth={3}
                          fill="none"
                       />
                       {/* 5th Percentile Line (Worst Case) */}
                       <Area
                          type="monotone"
                          dataKey="p05"
                          name="Worst Case (5th)"
                          stroke="#ef4444"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          fill="none"
                       />
                       {/* Accumulated Dividends Line */}
                       <Area
                          type="monotone"
                          dataKey="dividends"
                          name="Accumulated Dividends (Est)"
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
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                   <div className="glass-card p-4 rounded-xl border-l-4 border-emerald-500 bg-white/5">
                       <div className="text-xs text-neutral-400">Median Outcome</div>
                       <div className="text-xl font-bold text-white">{formatCurrency(riskMetrics.medianOutcome)}</div>
                   </div>
                   <div className="glass-card p-4 rounded-xl border-l-4 border-emerald-300 bg-white/5">
                       <div className="text-xs text-neutral-400">Best Case (95th)</div>
                       <div className="text-lg font-bold text-emerald-300">{formatCurrency(riskMetrics.best5Outcome)}</div>
                   </div>
                   <div className="glass-card p-4 rounded-xl border-l-4 border-rose-500 bg-white/5">
                       <div className="text-xs text-neutral-400">Worst Case (5th)</div>
                       <div className="text-lg font-bold text-rose-400">{formatCurrency(riskMetrics.worst5Outcome)}</div>
                   </div>
                    {/* New Dividends Card */}
                   <div className="glass-card p-4 rounded-xl border-l-4 border-blue-500 bg-white/5">
                       <div className="text-xs text-neutral-400">Est. Dividends</div>
                       <div className="text-lg font-bold text-blue-400">{formatCurrency(riskMetrics.totalDividends)}</div>
                   </div>
                   {/* Combined VaR and Sharpe into one if needed, or expand grid */}
                   <div className="glass-card p-4 rounded-xl border-l-4 border-yellow-500 bg-white/5">
                       <div className="text-xs text-neutral-400">Value at Risk</div>
                       <div className="text-lg font-bold text-yellow-400">{formatCurrency(riskMetrics.vaR > 0 ? riskMetrics.vaR : 0)}</div>
                   </div>
               </motion.div>
           )}
       </AnimatePresence>
    </div>
  );
}
