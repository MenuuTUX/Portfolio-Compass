'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, AlertTriangle, PieChart as PieIcon, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { ETF } from '@/types';
import { cn, formatCurrency, calculateRiskMetric } from '@/lib/utils';
import { useMemo, useState } from 'react';

interface ETFDetailsDrawerProps {
  etf: ETF | null;
  onClose: () => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];
const TIME_RANGES = ['1D', '1W', '1M', '1Y', '5Y'];

export default function ETFDetailsDrawer({ etf, onClose }: ETFDetailsDrawerProps) {
  const [timeRange, setTimeRange] = useState('1M');

  const historyData = useMemo(() => {
    if (!etf || !etf.history) return [];

    const now = new Date();
    const cutoffDate = new Date();

    switch (timeRange) {
        case '1D':
            // Show last 2 data points for a line, or filtered by 24h if intraday available.
            // Since we have daily closes, 1D is a bit meaningless without intraday,
            // but we can just show the very last point or last 2 days.
            // Let's assume 1D means "Recent Context" so maybe last 5 days?
            // Actually, usually 1D means intraday.
            // Given we only have daily closes, 1D might just show the last available price point as a single dot or line.
            // Let's default to last 5 days for "1D" to show some context, or just map it.
            // A better approach with daily data is 1W minimum. But request asked for 1D.
            // I'll filter for last 2 days to show the change.
            cutoffDate.setDate(now.getDate() - 2);
            break;
        case '1W':
            cutoffDate.setDate(now.getDate() - 7);
            break;
        case '1M':
            cutoffDate.setMonth(now.getMonth() - 1);
            break;
        case '1Y':
            cutoffDate.setFullYear(now.getFullYear() - 1);
            break;
        case '5Y':
            cutoffDate.setFullYear(now.getFullYear() - 5);
            break;
        default:
            cutoffDate.setMonth(now.getMonth() - 1);
    }

    return etf.history.filter(h => new Date(h.date) >= cutoffDate);
  }, [etf, timeRange]);

  const riskData = useMemo(() => {
    if (!etf) return null;
    return calculateRiskMetric(historyData); // Calculate risk based on view? Or full history? Usually full history is better for stats. Let's use filtered to show risk OF THAT PERIOD or full?
    // User probably wants risk metric of the asset in general, which usually implies recent volatility.
    // The previous implementation used "30 days" for risk.
    // Let's stick to using the displayed history for risk so the chart matches the volatility metric, or revert to fixed 30d.
    // Let's use the visible history for dynamic feedback.
  }, [etf, historyData]);

  const sectorData = useMemo(() => {
    if (!etf || !etf.sectors) return [];
    return Object.entries(etf.sectors).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);
  }, [etf]);

  return (
    <AnimatePresence>
      {etf && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.div
            key="drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 h-[85vh] bg-[#0a0a0a] border-t border-white/10 rounded-t-3xl z-50 overflow-hidden shadow-2xl glass-panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-white tracking-tight">{etf.ticker}</h2>
                  <p className="text-neutral-400 text-sm">{etf.name}</p>
                </div>
                <div className="h-8 w-[1px] bg-white/10 mx-2" />
                <div>
                  <div className="text-2xl font-light text-white">{formatCurrency(etf.price)}</div>
                  <div className={cn("text-xs font-medium", etf.changePercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {etf.changePercent >= 0 ? "+" : ""}{etf.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {riskData && (
                    <div className={cn("px-4 py-2 rounded-full border backdrop-blur-md flex items-center gap-2",
                        riskData.bgColor,
                        riskData.borderColor
                    )}>
                        <Activity className={cn("w-4 h-4", riskData.color)} />
                        <span className={cn("font-bold text-sm", riskData.color)}>{riskData.label}</span>
                    </div>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 h-[calc(85vh-88px)] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">

                {/* Left Col: Chart */}
                <div className="lg:col-span-2 bg-white/5 rounded-2xl p-6 border border-white/5 flex flex-col h-full min-h-[400px]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                        <h3 className="text-lg font-bold text-white">Price History</h3>
                    </div>
                    <div className="flex bg-black/20 rounded-lg p-1 gap-1">
                        {TIME_RANGES.map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={cn(
                                    "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                                    timeRange === range ? "bg-white/10 text-white" : "text-neutral-500 hover:text-neutral-300"
                                )}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                  </div>
                  <div className="flex-1 w-full h-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historyData}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                            dataKey="date"
                            hide
                        />
                        <YAxis
                            domain={['auto', 'auto']}
                            orientation="right"
                            tick={{ fill: '#737373', fontSize: 12 }}
                            tickFormatter={(value) => `$${value}`}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#171717', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: number) => [formatCurrency(value), 'Price']}
                            labelFormatter={(label) => new Date(label).toLocaleDateString()}
                        />
                        <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#10b981"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorPrice)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Right Col */}
                <div className="flex flex-col gap-6 h-full">

                  {/* Sector Breakdown */}
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5 flex-1 min-h-[300px]">
                     <div className="flex items-center gap-2 mb-4">
                        <PieIcon className="w-5 h-5 text-blue-400" />
                        <h3 className="text-lg font-bold text-white">Sector Allocation</h3>
                      </div>
                      <div className="h-[250px]">
                        {sectorData.length > 0 ? (
                             <ResponsiveContainer width="100%" height="100%">
                             <PieChart>
                               <Pie
                                 data={sectorData}
                                 cx="50%"
                                 cy="50%"
                                 innerRadius={60}
                                 outerRadius={80}
                                 paddingAngle={5}
                                 dataKey="value"
                               >
                                 {sectorData.map((entry, index) => (
                                   <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                 ))}
                               </Pie>
                               <Tooltip
                                 contentStyle={{ backgroundColor: '#171717', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                 itemStyle={{ color: '#fff' }}
                               />
                               <Legend
                                 layout="vertical"
                                 verticalAlign="middle"
                                 align="right"
                                 iconSize={8}
                                 wrapperStyle={{ fontSize: '12px', color: '#a3a3a3' }}
                               />
                             </PieChart>
                           </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
                                No sector data available
                            </div>
                        )}
                      </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                      <h3 className="text-lg font-bold text-white mb-4">Key Metrics</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <div className="text-xs text-neutral-500 mb-1">MER</div>
                            <div className="text-xl font-bold text-white">{etf.metrics.mer.toFixed(2)}%</div>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <div className="text-xs text-neutral-500 mb-1">Yield</div>
                            <div className="text-xl font-bold text-emerald-400">{etf.metrics.yield.toFixed(2)}%</div>
                        </div>
                         <div className="col-span-2 p-4 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-xs text-neutral-500 mb-1">Volatility ({timeRange})</div>
                                    <div className={cn("text-xl font-bold", riskData?.color)}>{(riskData?.stdDev! * 100).toFixed(2)}%</div>
                                </div>
                                {riskData && (
                                    <AlertTriangle className={cn("w-8 h-8 opacity-50", riskData.color)} />
                                )}
                            </div>
                        </div>
                      </div>
                  </div>

                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
