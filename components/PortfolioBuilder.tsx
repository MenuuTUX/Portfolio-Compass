'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Trash2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Portfolio } from '@/types';
import { motion } from 'framer-motion';

const COLORS = ['#10b981', '#3b82f6', '#f43f5e', '#f59e0b', '#8b5cf6'];

interface PortfolioBuilderProps {
  portfolio: Portfolio;
  onRemove: (ticker: string) => void;
  onUpdateWeight: (ticker: string, weight: number) => void;
  onClear: () => void;
}

export default function PortfolioBuilder({ portfolio, onRemove, onUpdateWeight, onClear }: PortfolioBuilderProps) {
  // Calculate aggregate metrics
  const totalWeight = portfolio.reduce((acc, item) => acc + item.weight, 0);
  const isValid = Math.abs(totalWeight - 100) < 0.1;

  // Aggregate Sector Allocation
  const sectorAllocation = portfolio.reduce((acc: {[key: string]: number}, item) => {
    Object.entries(item.sectors).forEach(([sector, amount]) => {
      acc[sector] = (acc[sector] || 0) + (amount * (item.weight / 100));
    });
    return acc;
  }, {});

  const pieData = Object.entries(sectorAllocation).map(([name, value]) => ({
    name, value: value * 100
  })).filter(x => x.value > 0);

  return (
    <section className="py-24 px-4 h-[calc(100vh-64px)] overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto"
      >
        <div className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Portfolio Builder</h2>
            <p className="text-neutral-400">Construct your custom allocation. Target 100% weight.</p>
          </div>
          <button
            onClick={onClear}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Reset
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
          {/* Holdings List */}
          <div className="lg:col-span-2 space-y-4">
            {portfolio.length === 0 ? (
              <div className="h-64 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-neutral-500">
                Select ETFs from the Market Engine to build your portfolio.
              </div>
            ) : (
              portfolio.map((item) => (
                <div key={item.ticker} className="glass-panel p-4 rounded-lg flex items-center gap-4 bg-white/5 border border-white/5">
                  <div className="w-16">
                    <div className="font-bold text-white">{item.ticker}</div>
                  </div>

                  <div className="flex-1">
                    <div className="text-sm text-neutral-400">{item.name}</div>
                    <div className="flex gap-4 mt-1 text-xs text-neutral-500">
                      <span>MER: {item.metrics.mer}%</span>
                      <span>Yield: {item.metrics.yield}%</span>
                    </div>
                  </div>

                  <div className="w-32">
                    <label className="text-xs text-neutral-500 block mb-1">Weight (%)</label>
                    <input
                      type="number"
                      value={item.weight}
                      onChange={(e) => onUpdateWeight(item.ticker, parseFloat(e.target.value))}
                      className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-right focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={() => onRemove(item.ticker)}
                    className="p-2 text-neutral-500 hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}

            {portfolio.length > 0 && (
               <div className={cn(
                 "p-4 rounded-lg border flex justify-between items-center",
                 isValid ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
               )}>
                 <span className="font-medium">Total Allocation</span>
                 <span className="font-bold text-xl">{totalWeight.toFixed(1)}%</span>
               </div>
            )}
          </div>

          {/* Visualization */}
          <div className="glass-panel p-6 rounded-xl flex flex-col bg-white/5 border border-white/5">
            <h3 className="text-lg font-medium text-white mb-6">Sector X-Ray</h3>
            <div className="flex-1 min-h-[300px]">
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
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                 <div className="h-full flex items-center justify-center text-neutral-600 text-sm">
                   Add holdings to see exposure
                 </div>
              )}
            </div>
            {pieData.length > 0 && (
               <div className="grid grid-cols-2 gap-2 mt-4">
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
        </div>
      </motion.div>
    </section>
  );
}
