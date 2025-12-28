'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Portfolio, PortfolioItem } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import PortfolioItemRow from './PortfolioItemRow';
import { Decimal } from 'decimal.js';
import WealthProjector from './WealthProjector';
import OptimizationPanel from './OptimizationPanel';
import AlgorithmExplainer from './AlgorithmExplainer';
import RiskReturnScatter from './RiskReturnScatter';
import CorrelationHeatmap from './CorrelationHeatmap';
import PortfolioTreemap from './PortfolioTreemap';

const COLORS = ['#10b981', '#3b82f6', '#f43f5e', '#f59e0b', '#8b5cf6'];

interface PortfolioBuilderProps {
  portfolio: Portfolio;
  onRemove: (ticker: string) => void;
  onUpdateWeight: (ticker: string, weight: number) => void;
  onUpdateShares: (ticker: string, shares: number) => void;
  onClear: () => void;
}

export default function PortfolioBuilder({ portfolio, onRemove, onUpdateWeight, onUpdateShares, onClear }: PortfolioBuilderProps) {
  const [viewMode, setViewMode] = useState<'BUILDER' | 'PROJECTION'>('BUILDER');

  // New internal view state for the Builder section
  const [builderView, setBuilderView] = useState<'LIST' | 'TREEMAP' | 'RISK'>('LIST');

  const [isOptimizerActive, setIsOptimizerActive] = useState(true);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Calculate aggregate metrics using Decimal for precision (Layer 1)
  const { totalWeight, totalValue } = useMemo(() => {
    return portfolio.reduce((acc, item) => {
      const weight = new Decimal(item.weight || 0);
      const price = new Decimal(item.price || 0);
      const shares = new Decimal(item.shares || 0);
      const value = price.times(shares);

      return {
        totalWeight: acc.totalWeight.plus(weight),
        totalValue: acc.totalValue.plus(value)
      };
    }, { totalWeight: new Decimal(0), totalValue: new Decimal(0) });
  }, [portfolio]);

  const isValid = totalWeight.minus(100).abs().lessThan(0.1);

  // Aggregate Sector Allocation
  const sectorAllocation = useMemo(() => {
     return portfolio.reduce((acc: { [key: string]: number }, item) => {
      if (item.sectors) {
        Object.entries(item.sectors).forEach(([sector, amount]) => {
          acc[sector] = (acc[sector] || 0) + (amount * (item.weight / 100));
        });
      }
      return acc;
    }, {});
  }, [portfolio]);

  // Local state for display to handle debounced sorting
  const [displayPortfolio, setDisplayPortfolio] = useState<Portfolio>(portfolio);
  const isInteracting = useRef(false);
  const sortTimeout = useRef<NodeJS.Timeout | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Sync portfolio props to displayPortfolio with debounce logic
  useEffect(() => {
    if (isInteracting.current) {
      setDisplayPortfolio(prev => {
        const newPortfolio = [...prev];
        portfolio.forEach(updatedItem => {
          const index = newPortfolio.findIndex(p => p.ticker === updatedItem.ticker);
          if (index !== -1) {
            newPortfolio[index] = updatedItem;
          } else {
            newPortfolio.push(updatedItem);
          }
        });
        return newPortfolio.filter(p => portfolio.some(pi => pi.ticker === p.ticker));
      });
    } else {
      setDisplayPortfolio([...portfolio].sort((a, b) => b.weight - a.weight));
    }
  }, [portfolio]);

  const handleInteraction = () => {
    isInteracting.current = true;
    if (sortTimeout.current) clearTimeout(sortTimeout.current);

    sortTimeout.current = setTimeout(() => {
      isInteracting.current = false;
      setDisplayPortfolio([...portfolio].sort((a, b) => b.weight - a.weight));
    }, 3000);
  };

  const handleUpdateShares = useCallback((ticker: string, shares: number) => {
    handleInteraction();
    onUpdateShares(ticker, shares);
  }, [onUpdateShares]);

  const handleUpdateWeight = useCallback((ticker: string, weight: number) => {
    handleInteraction();
    onUpdateWeight(ticker, weight);
  }, [onUpdateWeight]);

  const pieData = Object.entries(sectorAllocation).map(([name, value]) => ({
    name, value: value * 100
  })).filter(x => x.value > 0);

  // Virtualizer setup
  const rowVirtualizer = useVirtualizer({
    count: displayPortfolio.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  if (viewMode === 'PROJECTION') {
    return (
      <WealthProjector
        portfolio={portfolio}
        onBack={() => setViewMode('BUILDER')}
      />
    );
  }

  return (
    <section className="py-12 md:py-24 px-4 min-h-screen flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto w-full flex flex-col"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 flex-shrink-0">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Portfolio Builder</h2>
            <p className="text-sm md:text-base text-neutral-400">Construct your custom allocation. Target 100% weight.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
             <button
              onClick={() => setIsOptimizerActive(!isOptimizerActive)}
              className={cn(
                "flex-1 md:flex-none justify-center px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 cursor-pointer border",
                isOptimizerActive
                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]"
                  : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
              )}
            >
              Optimization Mode
            </button>
            <button
              onClick={() => setViewMode('PROJECTION')}
              className="flex-1 md:flex-none justify-center px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-all shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)] flex items-center gap-2 cursor-pointer"
            >
              See Growth Projection
            </button>
            <button
              onClick={onClear}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Reset
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex space-x-2 mb-6 border-b border-white/10 pb-1 overflow-x-auto">
          <button
            onClick={() => setBuilderView('LIST')}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap",
              builderView === 'LIST' ? "bg-white/10 text-emerald-400 border-b-2 border-emerald-500" : "text-neutral-400 hover:text-white hover:bg-white/5"
            )}
          >
            List View
          </button>
          <button
            onClick={() => setBuilderView('TREEMAP')}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap",
              builderView === 'TREEMAP' ? "bg-white/10 text-emerald-400 border-b-2 border-emerald-500" : "text-neutral-400 hover:text-white hover:bg-white/5"
            )}
          >
            Tree Map
          </button>
          <button
             onClick={() => setBuilderView('RISK')}
             className={cn(
               "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap",
               builderView === 'RISK' ? "bg-white/10 text-emerald-400 border-b-2 border-emerald-500" : "text-neutral-400 hover:text-white hover:bg-white/5"
             )}
           >
             Risk Analysis
           </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-4 h-[75vh] min-h-[600px]">
          {/* Main Content Area (Left 2/3) */}
          <div className={cn("lg:col-span-2 flex flex-col h-full min-h-0 transition-all duration-300", isCalibrating && "blur-sm opacity-50 pointer-events-none")}>

            {/* Header Stats - Only show in LIST or TREEMAP, maybe redundant for Risk but good for context */}
             {portfolio.length > 0 && (
              <div className="flex flex-col gap-2 mb-4 flex-shrink-0">
                <div className="p-4 rounded-lg border border-white/10 bg-white/5 flex justify-between items-center">
                  <span className="font-medium text-white">Total Portfolio Value</span>
                  <span className="font-bold text-xl text-emerald-400">
                    ${totalValue.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className={cn(
                  "p-4 rounded-lg border flex justify-between items-center",
                  isValid ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                )}>
                  <span className="font-medium">Total Allocation</span>
                  <span className="font-bold text-xl">{totalWeight.toNumber().toFixed(1)}%</span>
                </div>
              </div>
            )}

            {/* View Switcher Logic */}
            <div className="flex-1 min-h-0 relative flex flex-col">
                {builderView === 'LIST' && (
                    <div className="flex-1 border border-white/5 rounded-xl bg-white/[0.02] flex flex-col relative overflow-hidden">
                      {displayPortfolio.length === 0 ? (
                        <div className="h-full border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-neutral-400 text-center p-4">
                          Select ETFs from the Market Engine to build your portfolio.
                        </div>
                      ) : (
                        <div ref={parentRef} className="overflow-auto h-full w-full custom-scrollbar">
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-white/10 shadow-sm">
                              <tr>
                                <th className="p-4 text-xs font-medium text-neutral-400 uppercase tracking-wider w-[30%]">Asset</th>
                                <th className="p-4 text-xs font-medium text-neutral-400 uppercase tracking-wider hidden md:table-cell w-[20%]">Metrics</th>
                                <th className="p-4 text-xs font-medium text-neutral-400 uppercase tracking-wider w-[25%] md:w-[15%]">Position</th>
                                <th className="p-4 text-xs font-medium text-neutral-400 uppercase tracking-wider hidden md:table-cell w-[25%]">Allocation</th>
                                <th className="p-4 text-xs font-medium text-neutral-400 uppercase tracking-wider text-right w-[10%]">Action</th>
                              </tr>
                            </thead>
                            <tbody
                              style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                              }}
                            >
                              {rowVirtualizer.getVirtualItems().length > 0 && (
                                <tr style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }}>
                                  <td colSpan={5} style={{ border: 0, padding: 0 }} />
                                </tr>
                              )}

                              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                 const item = displayPortfolio[virtualRow.index];
                                 return (
                                   <PortfolioItemRow
                                     key={item.ticker}
                                     item={item}
                                     virtualRow={virtualRow}
                                     measureElement={rowVirtualizer.measureElement}
                                     onRemove={onRemove}
                                     onUpdateWeight={handleUpdateWeight}
                                     onUpdateShares={handleUpdateShares}
                                   />
                                 );
                              })}

                               {rowVirtualizer.getVirtualItems().length > 0 && (
                                <tr style={{
                                  height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px`
                                }}>
                                  <td colSpan={5} style={{ border: 0, padding: 0 }} />
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                )}

                {builderView === 'TREEMAP' && (
                    <PortfolioTreemap portfolio={portfolio} />
                )}

                {builderView === 'RISK' && (
                    <div className="flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar h-full">
                       <RiskReturnScatter items={portfolio} />
                       <CorrelationHeatmap assets={portfolio.map(p => p.ticker)} />
                    </div>
                )}
            </div>
          </div>

          {/* Right Column (Optimizer / Stats) */}
          <div className="flex flex-col gap-6 lg:h-full lg:overflow-y-auto custom-scrollbar pr-1">
            {isOptimizerActive && portfolio.length > 0 ? (
              <OptimizationPanel
                portfolio={portfolio}
                onCalibrating={setIsCalibrating}
                onApply={(newShares, newWeights) => {
                  Object.entries(newShares).forEach(([ticker, additionalShares]) => {
                     const currentShares = portfolio.find(p => p.ticker === ticker)?.shares || 0;
                     handleUpdateShares(ticker, currentShares + additionalShares);
                  });
                  Object.entries(newWeights).forEach(([ticker, weight]) => {
                    handleUpdateWeight(ticker, weight);
                  });
                  setIsOptimizerActive(false);
                }}
              />
            ) : (
              <div className="glass-panel p-6 rounded-xl flex flex-col bg-white/5 border border-white/5 h-fit">
                <h3 className="text-lg font-medium text-white mb-6 flex-shrink-0">Sector X-Ray</h3>
                <div className="w-full h-[300px] flex-shrink-0">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.5)" />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#000', borderColor: '#333', color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(value: number) => `${value.toFixed(2)}%`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-neutral-600 text-sm">
                      Add holdings to see exposure
                    </div>
                  )}
                  {pieData.length > 0 && (
                      <table className="sr-only">
                        <caption>Portfolio Sector Allocation</caption>
                        <thead>
                          <tr>
                            <th scope="col">Sector</th>
                            <th scope="col">Allocation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pieData.map((entry, index) => (
                            <tr key={index}>
                              <td>{entry.name}</td>
                              <td>{entry.value.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                  )}
                </div>
                {pieData.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-4 overflow-y-auto">
                    {pieData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-2 text-xs text-neutral-400">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="truncate">{entry.name}</span>
                        <span className="ml-auto text-white">{entry.value.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <AlgorithmExplainer />
      </motion.div>
    </section>
  );
}
