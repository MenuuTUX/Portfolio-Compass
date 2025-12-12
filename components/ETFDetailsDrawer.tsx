'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, AlertTriangle, PieChart as PieIcon, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ETF } from '@/types';
import { cn, formatCurrency, calculateRiskMetric } from '@/lib/utils';
import { calculateTTMYield } from '@/lib/finance';
import SectorPieChart from './SectorPieChart';
import { useMemo, useState, useEffect } from 'react';

interface ETFDetailsDrawerProps {
  etf: ETF | null;
  onClose: () => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];
const TIME_RANGES = ['1D', '1W', '1M', '1Y', '5Y'];

export default function ETFDetailsDrawer({ etf, onClose }: ETFDetailsDrawerProps) {
  const [timeRange, setTimeRange] = useState('1M');
  const [showComparison, setShowComparison] = useState(false);
  const [spyData, setSpyData] = useState<ETF | null>(null);
  const [freshEtf, setFreshEtf] = useState<ETF | null>(null);

  // Use fresh data if available, otherwise fall back to prop
  const displayEtf = freshEtf || etf;

  // Reset freshEtf when etf prop changes
  useEffect(() => {
    setFreshEtf(null);
  }, [etf]);

  // Fetch fresh data for the current ETF to ensure it's up to date
  useEffect(() => {
    if (!etf) return;

    const fetchFreshData = async () => {
      try {
        // This call will trigger the backend auto-sync if data is stale (>24h)
        const res = await fetch(`/api/etfs/search?query=${etf.ticker}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // Find the exact match
            const match = data.find(item => item.ticker === etf.ticker);
            if (match) {
              setFreshEtf(match);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch fresh ETF data:', err);
      }
    };

    fetchFreshData();
  }, [etf]);

  // Fetch SPY data when toggle is enabled
  useEffect(() => {
    if (showComparison && !spyData) {
      const fetchSpy = async () => {
        try {
          // 1. Try search first
          const searchRes = await fetch('/api/etfs/search?query=SPY', { cache: 'no-store' });
          const searchData = await searchRes.json();

          if (Array.isArray(searchData) && searchData.length > 0) {
            const spy = searchData[0];
            // Check if history exists and is sufficient
            if (spy.history && spy.history.length > 0) {
              // Check freshness (client-side double check)
              const lastDate = new Date(spy.history[spy.history.length - 1].date);
              const now = new Date();
              const isStale = (now.getTime() - lastDate.getTime()) > 60 * 60 * 1000; // > 1 hour

              if (!isStale) {
                setSpyData(spy);
                return;
              }
              console.log('SPY data found but stale (>1h). Forcing sync...');
            }
          }

          // 2. Fallback to sync if search failed or no history
          console.log('Fetching full SPY data via sync...');
          const syncRes = await fetch('/api/etfs/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker: 'SPY' })
          });

          if (syncRes.ok) {
            const syncData = await syncRes.json();
            setSpyData(syncData);
          }
        } catch (err) {
          console.error('Failed to fetch SPY data:', err);
        }
      };

      fetchSpy();
    }
  }, [showComparison, spyData]);

  const historyData = useMemo(() => {
    if (!displayEtf || !displayEtf.history) return [];

    let targetInterval = '1wk'; // Default fallback
    const now = new Date();
    const cutoffDate = new Date();

    // Map time range to required interval and cutoff date
    switch (timeRange) {
      case '1D':
        targetInterval = '1h';
        cutoffDate.setDate(now.getDate() - 2);
        break;
      case '1W':
        targetInterval = '1d';
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '1M':
        targetInterval = '1wk';
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case '1Y':
        targetInterval = '1wk';
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      case '5Y':
        targetInterval = '1mo';
        cutoffDate.setFullYear(now.getFullYear() - 5);
        break;
      default:
        targetInterval = '1wk';
        cutoffDate.setMonth(now.getMonth() - 1);
    }

    const filterAndSort = (history: any[]) => {
      return history
        .filter(h => {
          if (h.interval !== targetInterval) return false;
          return new Date(h.date) >= cutoffDate;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    };

    const etfHistory = filterAndSort(displayEtf.history);

    if (showComparison && spyData && spyData.history) {
      const spyHistory = filterAndSort(spyData.history);

      // Helper to find closest SPY price within tolerance
      const getSpyPriceAt = (targetDate: Date) => {
        if (spyHistory.length === 0) return null;

        const targetTime = targetDate.getTime();
        // Tolerance: 30 minutes for 1h/1d, 1 day for 1w/1m/1y
        const tolerance = (timeRange === '1D' || timeRange === '1W')
          ? 30 * 60 * 1000
          : 24 * 60 * 60 * 1000;

        // Find closest data point
        // Optimization: spyHistory is sorted. We could use binary search or just find.
        // Given array size is small (<1000), a simple reduce or find is acceptable.

        let closest = spyHistory[0];
        let minDiff = Math.abs(new Date(closest.date).getTime() - targetTime);

        for (let i = 1; i < spyHistory.length; i++) {
          const current = spyHistory[i];
          const diff = Math.abs(new Date(current.date).getTime() - targetTime);
          if (diff < minDiff) {
            minDiff = diff;
            closest = current;
          }
        }

        if (minDiff <= tolerance) {
          return closest.price;
        }
        return null;
      };

      if (etfHistory.length > 0) {
        const etfStart = etfHistory[0].price;

        // Find closest SPY start price to align the charts
        const spyStartPrice = getSpyPriceAt(new Date(etfHistory[0].date));
        const spyStart = spyStartPrice || (spyHistory.length > 0 ? spyHistory[0].price : 1);

        // Calculate scale factor to make SPY start at the same level as ETF
        const scaleFactor = etfStart / spyStart;

        return etfHistory.map(h => {
          const rawSpyPrice = getSpyPriceAt(new Date(h.date));

          return {
            date: h.date,
            price: h.price,
            spyPrice: rawSpyPrice ? rawSpyPrice * scaleFactor : null,
            originalSpyPrice: rawSpyPrice // Store original for tooltip
          };
        });
      }
    }

    return etfHistory;
  }, [displayEtf, timeRange, showComparison, spyData]);

  const { percentageChange, isPositive } = useMemo(() => {
    if (!displayEtf || !displayEtf.history || displayEtf.history.length < 2) return { percentageChange: 0, isPositive: true };
    // Use raw history for the header metric, not the chart data
    // We need to filter raw history by the current time range to match the chart's "view"
    // Re-using the logic from historyData but strictly for the main ETF

    // ... (logic duplicated for simplicity, or we could extract it)
    // For now, let's just use the last known price vs first known price in the filtered set
    // But wait, historyData is already filtered!
    // If showComparison is true, historyData is percentages. If false, it's prices.

    if (historyData.length < 2) return { percentageChange: 0, isPositive: true };

    // Always calculate percentage change based on price difference of the main ETF
    // In comparison mode, 'price' is still the dollar value now.
    const startPrice = historyData[0].price;
    const endPrice = historyData[historyData.length - 1].price;
    const change = ((endPrice - startPrice) / startPrice) * 100;
    return { percentageChange: change, isPositive: change >= 0 };
  }, [historyData, showComparison, displayEtf]);

  const riskData = useMemo(() => {
    if (!displayEtf) return null;
    // Risk metric should probably stay based on the ETF's raw data
    // We can pass the raw filtered history if we want to be precise,
    // but for now passing the potentially transformed historyData might be misleading if it's normalized.
    // Let's assume calculateRiskMetric handles raw prices.
    // If showComparison is on, historyData is percentages. calculateRiskMetric likely expects prices.
    // So we should probably disable or ignore risk calculation on the transformed data,
    // OR re-calculate it based on raw data.
    // For simplicity, let's just use the ETF's raw history for the risk metric display,
    // ignoring the time range filter for the *overall* risk label if that's acceptable,
    // OR we filter it again.
    // Let's just use the full history for the risk label as it was before (likely).
    // Actually, the previous code used `historyData` which was filtered.
    // If we want to keep it simple, we can just hide risk data in comparison mode or re-compute.
    // Let's re-compute using raw filtered data if needed, but for now let's just return null if comparing to avoid confusion/errors.
    if (showComparison) return null;

    return calculateRiskMetric(historyData);
  }, [displayEtf, historyData, showComparison]);

  const sectorData = useMemo(() => {
    if (!displayEtf || !displayEtf.sectors) return [];
    return Object.entries(displayEtf.sectors).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);
  }, [displayEtf]);

  return (
    <AnimatePresence>
      {displayEtf && (
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
                  <h2 className="text-3xl font-bold text-white tracking-tight">{displayEtf.ticker}</h2>
                  <p className="text-neutral-400 text-sm">{displayEtf.name}</p>
                </div>
                <div className="h-8 w-[1px] bg-white/10 mx-2" />
                <div>
                  <div className="text-2xl font-light text-white">{formatCurrency(displayEtf.price)}</div>
                  <div className={cn("text-xs font-medium", isPositive ? "text-emerald-400" : "text-rose-400")}>
                    {isPositive ? "+" : ""}{percentageChange.toFixed(2)}%
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

                    <div className="flex items-center gap-4">
                      {/* Comparison Toggle */}
                      <div className="flex items-center gap-2 bg-black/20 rounded-lg p-1 px-2">
                        <span className={cn("text-xs font-medium transition-colors", showComparison ? "text-white" : "text-neutral-500")}>vs SPY</span>
                        <button
                          onClick={() => setShowComparison(!showComparison)}
                          className={cn(
                            "w-8 h-4 rounded-full relative transition-colors duration-300 focus:outline-none",
                            showComparison ? "bg-emerald-500" : "bg-neutral-700"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-300",
                            showComparison ? "translate-x-4" : "translate-x-0"
                          )} />
                        </button>
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
                  </div>
                  <div className="flex-1 w-full h-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historyData}>
                        <defs>
                          <linearGradient id="colorPriceUp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorPriceDown" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.5} />
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorSpy" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.5} />
                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
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
                          tickFormatter={(value) => formatCurrency(value)}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#171717', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(value: number, name: string, item: any) => {
                            if (name === 'spyPrice') {
                              // Show original SPY price if available
                              const original = item.payload.originalSpyPrice;
                              return [original ? formatCurrency(original) : 'N/A', 'SPY'];
                            }
                            return [formatCurrency(value), displayEtf.ticker];
                          }}
                          labelFormatter={(label) => new Date(label).toLocaleDateString() + ' ' + new Date(label).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        />
                        <Area
                          type="monotone"
                          dataKey="price"
                          stroke={isPositive ? "#10b981" : "#f43f5e"}
                          strokeWidth={2}
                          fillOpacity={1}
                          fill={`url(#${isPositive ? 'colorPriceUp' : 'colorPriceDown'})`}
                        />
                        {showComparison && (
                          <Area
                            type="monotone"
                            dataKey="spyPrice"
                            stroke="#94a3b8"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            strokeOpacity={0.7}
                            fillOpacity={0.1}
                            fill="url(#colorSpy)"
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                    <table className="sr-only">
                      <caption>Price History for {displayEtf.ticker}</caption>
                      <thead>
                        <tr>
                          <th scope="col">Date</th>
                          <th scope="col">Price</th>
                          {showComparison && <th scope="col">SPY Price</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.map((item, index) => (
                          <tr key={index}>
                            <td>{new Date(item.date).toLocaleDateString()}</td>
                            <td>{formatCurrency(item.price)}</td>
                            {showComparison && <td>{item.spyPrice ? formatCurrency(item.spyPrice) : 'N/A'}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Col */}
                <div className="flex flex-col gap-6 h-full">

                  {/* Sector Breakdown */}
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5 flex-1 min-h-[300px]">
                    <div className="flex items-center gap-2 mb-4">
                      <PieIcon className="w-5 h-5 text-blue-400" />
                      <h3 className="text-lg font-bold text-white">
                        {displayEtf.assetType === 'STOCK' ? 'Sector' : 'Sector Allocation'}
                      </h3>
                    </div>

                    {displayEtf.assetType === 'STOCK' ? (
                      <div className="h-[250px] flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-white mb-2">
                            {sectorData.length > 0 ? sectorData[0].name : 'Unknown'}
                          </div>
                          <div className="text-neutral-400 text-sm">
                            Sector
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[250px]">
                        <SectorPieChart sectors={displayEtf.sectors} />
                      </div>
                    )}
                  </div>

                  {/* Metrics Grid */}
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4">Key Metrics</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {displayEtf.assetType !== 'STOCK' && (
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                          <div className="text-xs text-neutral-500 mb-1">MER</div>
                          <div className="text-xl font-bold text-white">{displayEtf.metrics.mer.toFixed(2)}%</div>
                        </div>
                      )}
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <div className="text-xs text-neutral-500 mb-1">Yield (TTM)</div>
                        <div className="text-xl font-bold text-emerald-400">
                          {displayEtf.dividendHistory && displayEtf.dividendHistory.length > 0
                            ? calculateTTMYield(displayEtf.dividendHistory, displayEtf.price).toFixed(2)
                            : displayEtf.metrics.yield.toFixed(2)}%
                        </div>
                      </div>
                      <div className="col-span-2 p-4 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-neutral-500 mb-1">Volatility ({timeRange})</div>
                            <div className={cn("text-xl font-bold", riskData?.color)}>{riskData ? (riskData.stdDev! * 100).toFixed(2) : 'N/A'}%</div>
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
