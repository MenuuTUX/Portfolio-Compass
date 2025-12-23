'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, AlertTriangle, PieChart as PieIcon, Activity, ChevronLeft, Layers } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ETF } from '@/types';
import { cn, formatCurrency, calculateRiskMetric } from '@/lib/utils';
import { calculateTTMYield } from '@/lib/finance';
import { getProviderLogo } from '@/lib/etf-providers';
import SectorPieChart, { COLORS } from './SectorPieChart';
import StockInfoCard from './StockInfoCard';
import { useMemo, useState, useEffect } from 'react';

interface ETFDetailsDrawerProps {
  etf: ETF | null;
  onClose: () => void;
}

const TIME_RANGES = ['1D', '1W', '1M', '1Y', '5Y'];

// Helper to format sector names (snake_case -> Title Case)
const formatSectorName = (name: string) => {
  return name.split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function ETFDetailsDrawer({ etf, onClose }: ETFDetailsDrawerProps) {
  const [timeRange, setTimeRange] = useState('1M');
  const [showComparison, setShowComparison] = useState(false);
  const [spyData, setSpyData] = useState<ETF | null>(null);
  const [freshEtf, setFreshEtf] = useState<ETF | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [showAllHoldings, setShowAllHoldings] = useState(false);

  // Use fresh data if available, otherwise fall back to prop
  const displayEtf = freshEtf || etf;

  // Reset freshEtf when etf prop changes
  useEffect(() => {
    setFreshEtf(null);
    setShowLegend(false);
    setShowAllHoldings(false);
  }, [etf]);

  // Fetch fresh data for the current ETF to ensure it's up to date
  useEffect(() => {
    if (!etf) return;

    const fetchFreshData = async () => {
      try {
        // This call will trigger the backend auto-sync if data is stale (>24h)
        // Request full history for the detailed chart
        const res = await fetch(`/api/etfs/search?query=${etf.ticker}&full=true`);
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

  const filteredEtfHistory = useMemo(() => {
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

    return filterAndSort(displayEtf.history);
  }, [displayEtf, timeRange]);

  const historyData = useMemo(() => {
    if (filteredEtfHistory.length === 0) return [];

    if (showComparison && spyData && spyData.history) {
      // Re-implement filter logic for SPY to match ETF
      // We can't reuse the exact function scope but we can replicate the logic
      // Ideally we would extract filterAndSort but for now let's duplicate the simple logic or find a way to share
      // Let's just create a helper inside since we need targetInterval/cutoffDate

      let targetInterval = '1wk';
      const now = new Date();
      const cutoffDate = new Date();
      switch (timeRange) {
        case '1D': targetInterval = '1h'; cutoffDate.setDate(now.getDate() - 2); break;
        case '1W': targetInterval = '1d'; cutoffDate.setDate(now.getDate() - 7); break;
        case '1M': targetInterval = '1wk'; cutoffDate.setMonth(now.getMonth() - 1); break;
        case '1Y': targetInterval = '1wk'; cutoffDate.setFullYear(now.getFullYear() - 1); break;
        case '5Y': targetInterval = '1mo'; cutoffDate.setFullYear(now.getFullYear() - 5); break;
        default: targetInterval = '1wk'; cutoffDate.setMonth(now.getMonth() - 1);
      }

      const spyHistory = spyData.history
        .filter((h: any) => {
          if (h.interval !== targetInterval) return false;
          return new Date(h.date) >= cutoffDate;
        })
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Helper to find closest SPY price within tolerance
      const getSpyPriceAt = (targetDate: Date) => {
        if (spyHistory.length === 0) return null;

        const targetTime = targetDate.getTime();
        // Tolerance: 30 minutes for 1h/1d, 1 day for 1w/1m/1y
        const tolerance = (timeRange === '1D' || timeRange === '1W')
          ? 30 * 60 * 1000
          : 24 * 60 * 60 * 1000;

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

      if (filteredEtfHistory.length > 0) {
        const etfStart = filteredEtfHistory[0].price;
        // Find closest SPY start price to align the charts
        const spyStartPrice = getSpyPriceAt(new Date(filteredEtfHistory[0].date));
        const spyStart = spyStartPrice || (spyHistory.length > 0 ? spyHistory[0].price : 1);

        return filteredEtfHistory.map(h => {
          const rawSpyPrice = getSpyPriceAt(new Date(h.date));
          const spyPct = rawSpyPrice ? ((rawSpyPrice - spyStart) / spyStart) * 100 : null;
          const etfPct = ((h.price - etfStart) / etfStart) * 100;

          return {
            date: h.date,
            price: etfPct,
            originalPrice: h.price,
            spyPrice: spyPct,
            originalSpyPrice: rawSpyPrice
          };
        });
      }
    }

    return filteredEtfHistory;
  }, [filteredEtfHistory, showComparison, spyData, timeRange]);

  const { percentageChange, isPositive } = useMemo(() => {
    if (filteredEtfHistory.length < 2) return { percentageChange: 0, isPositive: true };

    const startPrice = filteredEtfHistory[0].price;
    const endPrice = filteredEtfHistory[filteredEtfHistory.length - 1].price;
    const change = ((endPrice - startPrice) / startPrice) * 100;
    return { percentageChange: change, isPositive: change >= 0 };
  }, [filteredEtfHistory]);

  const riskData = useMemo(() => {
    if (!displayEtf) return null;
    return calculateRiskMetric(filteredEtfHistory);
  }, [displayEtf, filteredEtfHistory]);

  const sectorData = useMemo(() => {
    if (!displayEtf) return [];

    // 1. Try Sectors
    if (displayEtf.sectors && Object.keys(displayEtf.sectors).length > 0) {
        const raw = Object.entries(displayEtf.sectors).map(([name, value]) => ({
            name: formatSectorName(name),
            value
        }));

        const total = raw.reduce((sum, item) => sum + item.value, 0);
        // If total is small (e.g. <= 1.5), assume decimals and convert to percent
        const shouldScale = total <= 1.5;

        return raw.map(item => ({
            ...item,
            value: shouldScale ? item.value * 100 : item.value
        })).sort((a, b) => b.value - a.value);
    }

    // 2. Fallback: Holdings (Top 10 by weight)
    if (displayEtf.holdings && displayEtf.holdings.length > 0) {
        return displayEtf.holdings
            .slice(0, 10)
            .map(h => ({
                name: h.name || h.ticker,
                value: h.weight * 100 // Convert to percentage (0.05 -> 5.0)
            }))
            .sort((a, b) => b.value - a.value);
    }

    return [];
  }, [displayEtf]);

  const allHoldings = useMemo(() => {
    if (!displayEtf?.holdings) return [];
    return [...displayEtf.holdings].sort((a, b) => b.weight - a.weight);
  }, [displayEtf]);

  const topHoldings = useMemo(() => allHoldings.slice(0, 5), [allHoldings]);

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
                {/* Provider Logo */}
                {getProviderLogo(displayEtf.name) && (
                  <div className="w-12 h-12 rounded-xl bg-white p-2 flex items-center justify-center shrink-0">
                    <img
                      src={getProviderLogo(displayEtf.name)!}
                      alt={`${displayEtf.name} logo`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
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

            <div className="p-6 h-[calc(85vh-88px)] overflow-y-auto lg:overflow-hidden">
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
                        <span className={cn("text-xs font-medium transition-colors", showComparison ? "text-white" : "text-neutral-400")}>vs SPY</span>
                        <button
                          onClick={() => setShowComparison(!showComparison)}
                          aria-label={showComparison ? "Disable SPY comparison" : "Enable SPY comparison"}
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
                              timeRange === range ? "bg-white/10 text-white" : "text-neutral-400 hover:text-neutral-300"
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
                          tickFormatter={(value) => showComparison ? `${value.toFixed(2)}%` : formatCurrency(value)}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#171717', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(value: number, name: string, item: any) => {
                            if (showComparison) {
                              if (name === 'spyPrice') {
                                return [`${value != null ? value.toFixed(2) : '0.00'}%`, 'SPY'];
                              }
                              return [`${value.toFixed(2)}%`, displayEtf.ticker];
                            }
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
                            <td>{showComparison ? `${item.price.toFixed(2)}%` : formatCurrency(item.price)}</td>
                            {showComparison && <td>{item.spyPrice ? `${item.spyPrice.toFixed(2)}%` : 'N/A'}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Col Wrapper */}
                <div className="lg:col-span-1 lg:h-full lg:overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                  {/* Sector Breakdown or Stock Info */}
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5 min-h-[300px] flex flex-col">
                    {displayEtf.assetType === 'STOCK' ? (
                      <div className="flex-1 min-h-0">
                        <StockInfoCard ticker={displayEtf.ticker} />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-4 justify-between">
                            <div
                                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setShowLegend(!showLegend)}
                            >
                                <PieIcon className="w-5 h-5 text-blue-400" />
                                <h3 className="text-lg font-bold text-white">
                                    Sector Allocation
                                </h3>
                                <div className={cn("text-xs bg-white/10 px-2 py-0.5 rounded text-neutral-400 transition-colors", showLegend && "bg-blue-500/20 text-blue-300")}>
                                    Legend
                                </div>
                            </div>
                        </div>

                        {showLegend && (
                            <div className="mb-4 grid grid-cols-2 gap-2 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
                                {sectorData.map((item, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                        <span className="text-neutral-300 truncate">{item.name}</span>
                                        <span className="text-neutral-500 ml-auto">{item.value.toFixed(1)}%</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {showAllHoldings ? (
                            <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/5">
                                    <button
                                        onClick={() => setShowAllHoldings(false)}
                                        className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Back
                                    </button>
                                    <span className="text-sm font-medium text-white ml-auto">All Holdings ({allHoldings.length})</span>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[300px]">
                                    {allHoldings.length > 0 ? (
                                        <div className="space-y-3">
                                            {allHoldings.map((h, i) => (
                                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                                    <div>
                                                        <div className="font-bold text-white text-sm">{h.ticker}</div>
                                                        <div className="text-xs text-neutral-400 truncate max-w-[120px]">{h.name}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-emerald-400 font-medium text-sm">{(h.weight * 100).toFixed(2)}%</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-40 text-neutral-500 text-sm text-center">
                                            <Layers className="w-8 h-8 mb-2 opacity-50" />
                                            <p>No holdings found.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-row h-[250px] gap-4">
                                {/* Left: Holdings List */}
                                <div
                                    className="w-1/2 flex flex-col cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-colors group"
                                    onClick={() => setShowAllHoldings(true)}
                                >
                                    <div className="text-xs font-semibold text-neutral-400 mb-2 group-hover:text-white transition-colors">Top Holdings</div>
                                    <div className="flex-1 overflow-y-hidden space-y-2">
                                        {topHoldings.map((h, i) => (
                                            <div key={i} className="flex items-center justify-between text-xs">
                                                <div className="font-medium text-white truncate max-w-[80px]">{h.ticker}</div>
                                                <div className="text-emerald-400">{(h.weight * 100).toFixed(1)}%</div>
                                            </div>
                                        ))}
                                        {topHoldings.length === 0 && (
                                            <div className="text-neutral-500 text-xs italic">No holdings data</div>
                                        )}
                                        {allHoldings.length > 5 && (
                                            <div className="text-xs text-blue-400 mt-2 font-medium">See all {allHoldings.length}...</div>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Pie Chart */}
                                <div className="w-1/2 relative">
                                    <SectorPieChart
                                        data={sectorData}
                                        isLoading={false}
                                    />
                                    {(!displayEtf.sectors || Object.keys(displayEtf.sectors).length === 0) && (
                                         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="text-xs text-neutral-500 bg-black/80 px-2 py-1 rounded">No Sector Data</span>
                                         </div>
                                    )}
                                </div>
                            </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Metrics Grid */}
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4">Key Metrics</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {displayEtf.assetType !== 'STOCK' && (
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                          <div className="text-xs text-neutral-400 mb-1">MER</div>
                          <div className="text-xl font-bold text-white">{displayEtf.metrics.mer.toFixed(2)}%</div>
                        </div>
                      )}
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <div className="text-xs text-neutral-400 mb-1">Yield (TTM)</div>
                        <div className="text-xl font-bold text-emerald-400">
                          {displayEtf.dividendHistory && displayEtf.dividendHistory.length > 0
                            ? calculateTTMYield(displayEtf.dividendHistory, displayEtf.price).toFixed(2)
                            : displayEtf.metrics.yield.toFixed(2)}%
                        </div>
                      </div>
                      <div className="col-span-2 p-4 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-neutral-400 mb-1">Volatility ({timeRange})</div>
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
