'use client';

import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line } from 'recharts';
import { cn, formatCurrency } from '@/lib/utils';
import { Portfolio } from '@/types';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, RefreshCw } from 'lucide-react';
import MonteCarloSimulator from './simulation/MonteCarloSimulator';
import { calculatePortfolioHistoricalStats } from '@/lib/math/portfolio-stats';

interface WealthProjectorProps {
  portfolio: Portfolio;
  onBack?: () => void;
}

export default function WealthProjector({ portfolio, onBack }: WealthProjectorProps) {
  const [mode, setMode] = useState<'SIMPLE' | 'MONTE_CARLO'>('SIMPLE');

  // Calculate current portfolio value
  const currentPortfolioValue = portfolio.reduce((sum, item) => {
    return sum + (item.price * (item.shares || 0));
  }, 0);

  // Simple Projection Logic
  // Initialize with portfolio value if > 0, else 10000
  const [initialInvestment, setInitialInvestment] = useState<number>(() => {
    return currentPortfolioValue > 0 ? currentPortfolioValue : 10000;
  });

  const [monthlyContribution, setMonthlyContribution] = useState<number>(500);
  const [years, setYears] = useState<number>(20);
  const [historicalReturn, setHistoricalReturn] = useState<number | null>(null);

  // Effect to sync initialInvestment with portfolio value if it loads later and we are at default
  useEffect(() => {
    if (currentPortfolioValue > 0 && initialInvestment === 10000) {
      setInitialInvestment(currentPortfolioValue);
    }
  }, [currentPortfolioValue, initialInvestment]);

  useEffect(() => {
      // Try to get historical stats if available
      // Check if we have history
      const hasHistory = portfolio.some(p => p.history && p.history.length > 30);
      if (hasHistory) {
          try {
              const stats = calculatePortfolioHistoricalStats(portfolio);
              if (stats.annualizedReturn !== 0) {
                  setHistoricalReturn(stats.annualizedReturn);
              }
          } catch (e) {
              console.warn("Failed to calc historical stats for simple projection", e);
          }
      }
  }, [portfolio]);

  // Calculate Weighted Average Return & Yield
  let weightedReturn = historicalReturn !== null ? historicalReturn : 0.07;
  let weightedYield = 0;

  if (portfolio.length > 0) {
    const totalWeight = portfolio.reduce((acc, item) => acc + item.weight, 0);
    if (totalWeight > 0) {
      // Calculate Yield specifically
      weightedYield = portfolio.reduce((acc, item) => {
         // item.metrics.yield is typically a percentage (e.g. 1.5 for 1.5%)
         // Check if yield exists, default to 0
         const yieldVal = item.metrics?.yield || 0;
         return acc + ((yieldVal / 100) * (item.weight / totalWeight));
      }, 0);

      // If no historical return, calculate heuristic total return
      if (historicalReturn === null) {
        weightedReturn = portfolio.reduce((acc, item) => {
          let growthRate = 0.06;
          if (item.ticker.includes('ZAG')) growthRate = 0.01;
          const estimatedTotalReturn = ((item.metrics?.yield || 0) / 100) + growthRate;
          return acc + (estimatedTotalReturn * (item.weight / totalWeight));
        }, 0);
      }
    }
  }

  let balance = initialInvestment;
  let accumulatedDividends = 0;
  const data = [];
  const monthlyRate = weightedReturn / 12;
  const monthlyYieldRate = weightedYield / 12;

  for (let i = 0; i <= years * 12; i++) {
    if (i % 12 === 0) {
      data.push({
        year: `Y${i / 12}`,
        balance: Math.round(balance),
        invested: initialInvestment + (monthlyContribution * i),
        dividends: Math.round(accumulatedDividends)
      });
    }

    // Calculate dividend for this month based on current balance
    const monthlyDividend = balance * monthlyYieldRate;
    accumulatedDividends += monthlyDividend;

    // Compound balance
    balance = (balance + monthlyContribution) * (1 + monthlyRate);
  }

  const projectionData = data;
  const finalAmount = projectionData.length > 0 ? projectionData[projectionData.length - 1].balance : 0;
  const totalInvested = projectionData.length > 0 ? projectionData[projectionData.length - 1].invested : 0;
  const totalDividends = projectionData.length > 0 ? projectionData[projectionData.length - 1].dividends : 0;

  if (mode === 'MONTE_CARLO') {
      return (
          <section className="py-12 px-4 max-w-7xl mx-auto h-full overflow-y-auto">
             <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setMode('SIMPLE')}
                    className="text-sm text-neutral-400 hover:text-white underline"
                  >
                      Switch to Simple Projection
                  </button>
             </div>
             <MonteCarloSimulator portfolio={portfolio} onBack={onBack} />
          </section>
      );
  }

  return (
    <section className="py-24 px-4 max-w-7xl mx-auto h-[calc(100vh-64px)] overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                title="Back to Portfolio"
                aria-label="Back to Portfolio"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Wealth Projector</h2>
              <p className="text-neutral-400">Project your future wealth based on portfolio assumptions.</p>
            </div>
          </div>

          <button
             onClick={() => setMode('MONTE_CARLO')}
             className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-purple-900/20 border border-white/10"
          >
             <Sparkles className="w-4 h-4" />
             Try Monte Carlo Simulation
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-20">
          {/* Controls */}
          <div className="glass-panel p-6 rounded-xl space-y-6 h-fit bg-white/5 border border-white/5">
            <div>
              <div className="flex items-center justify-between mb-2">
                 <label htmlFor="initial-investment" className="text-sm text-neutral-400 block">Starting Balance</label>
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
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400">$</span>
                <input
                  id="initial-investment"
                  type="number"
                  value={initialInvestment}
                  onChange={(e) => setInitialInvestment(Number(e.target.value))}
                  className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="monthly-contribution" className="text-sm text-neutral-400 block mb-2">Monthly Contribution</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400">$</span>
                <input
                  id="monthly-contribution"
                  type="number"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                  className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="time-horizon" className="text-sm text-neutral-400 block mb-2">Time Horizon (Years): {years}</label>
              <input
                id="time-horizon"
                type="range"
                min="5"
                max="50"
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="pt-6 border-t border-white/10 space-y-4">
              <div>
                <div className="text-sm text-neutral-400 mb-1">Projected Annual Return</div>
                <div className="text-2xl font-bold text-emerald-400">{(weightedReturn * 100).toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-sm text-neutral-400 mb-1">Avg. Dividend Yield</div>
                <div className="text-xl font-bold text-blue-400">{(weightedYield * 100).toFixed(2)}%</div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="lg:col-span-3 glass-panel p-6 rounded-xl flex flex-col bg-white/5 border border-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <div className="text-sm text-neutral-400">Projected Wealth</div>
                <div className="text-3xl font-bold text-white">{formatCurrency(finalAmount)}</div>
              </div>
              <div>
                 <div className="text-sm text-neutral-400">Est. Dividends Gained</div>
                 <div className="text-3xl font-bold text-blue-400">{formatCurrency(totalDividends)}</div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-sm text-neutral-400">Total Invested</div>
                <div className="text-xl font-medium text-neutral-300">{formatCurrency(totalInvested)}</div>
              </div>
            </div>

            <div className="flex-1 min-h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="year" stroke="#666" tick={{fill: '#666'}} axisLine={false} tickLine={false} />
                  <YAxis
                    stroke="#666"
                    tick={{fill: '#666'}}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `$${value/1000}k`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#000', borderColor: '#333', color: '#fff' }}
                    formatter={(value: any) => formatCurrency(Number(value))}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    name="Projected Balance"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorBalance)"
                  />
                  <Area
                    type="monotone"
                    dataKey="invested"
                    name="Total Invested"
                    stroke="#525252"
                    strokeDasharray="5 5"
                    fill="transparent"
                  />
                  <Area
                    type="monotone"
                    dataKey="dividends"
                    name="Accumulated Dividends"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <table className="sr-only">
                <caption>Wealth Projection</caption>
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col">Projected Balance</th>
                    <th scope="col">Total Invested</th>
                    <th scope="col">Accumulated Dividends</th>
                  </tr>
                </thead>
                <tbody>
                  {projectionData.map((item, index) => (
                    <tr key={index}>
                      <td>{item.year}</td>
                      <td>{formatCurrency(item.balance)}</td>
                      <td>{formatCurrency(item.invested)}</td>
                      <td>{formatCurrency(item.dividends)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
