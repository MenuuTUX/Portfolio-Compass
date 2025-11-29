'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { cn, formatCurrency } from '@/lib/utils';
import { ETF } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

interface SparklineProps {
  data: number[];
  color: string;
}

// Sparkline component
const Sparkline = ({ data, color }: SparklineProps) => (
  <div className="h-16 w-32">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data.map((val, i) => ({ i, val }))}>
        <YAxis domain={['dataMin', 'dataMax']} hide />
        <Line
          type="monotone"
          dataKey="val"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

interface ComparisonEngineProps {
  onAddToPortfolio: (etf: ETF) => void;
}

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function ComparisonEngine({ onAddToPortfolio }: ComparisonEngineProps) {
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ETF[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(search, 500);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchEtfs = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/etfs/search?query=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data: ETF[] = await res.json();
      setEtfs(data);
      // For simple implementation, suggestions are just the search results
      // In a more complex app, we might have a separate lightweight endpoint for suggestions
      setSuggestions(data);
    } catch (err) {
      console.error("Failed to load ETF data", err);
      setEtfs([]);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Effect for main search/grid
  useEffect(() => {
    fetchEtfs(debouncedSearch);
  }, [debouncedSearch, fetchEtfs]);

  // Handle typing to show suggestions
  useEffect(() => {
    if (search.length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [search]);

  const handleSuggestionClick = (etf: ETF) => {
    setSearch(etf.ticker);
    setShowSuggestions(false);
    // Since search updates, the main effect will run and filter the grid to just this one
  };

  return (
    <section className="py-24 px-4 max-w-7xl mx-auto h-[calc(100vh-64px)] overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Market Engine</h2>
            <p className="text-neutral-400">Real-time analysis of leading ETFs. Click to add to builder.</p>
          </div>

          {/* Search Bar with Smart Autocomplete */}
          <div className="relative w-full md:w-96" ref={searchContainerRef}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <Search className="h-6 w-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)] transition-all" />
              </div>
              <input
                type="text"
                placeholder="Search ticker or name..."
                className="block w-full pl-12 pr-3 py-4 border border-white/10 rounded-xl bg-white/5 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-md transition-all text-lg shadow-lg"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => { if (search) setShowSuggestions(true); }}
              />
            </div>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.ul
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-50 w-full mt-2 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl"
                >
                  {suggestions.slice(0, 5).map((item) => (
                    <motion.li
                      key={item.ticker}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => handleSuggestionClick(item)}
                    >
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex flex-col">
                            <span className="font-bold text-white text-sm">{item.ticker}</span>
                            <span className="text-xs text-neutral-400 truncate max-w-[200px]">{item.name}</span>
                        </div>
                        <div className={cn("text-xs font-medium", item.changePercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {formatCurrency(item.price)}
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[1,2,3].map(i => (
               <div key={i} className="h-64 rounded-xl bg-white/5 animate-pulse" />
             ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
            {etfs.map((etf) => {
              const isPositive = etf.changePercent >= 0;
              return (
                <div
                  key={etf.ticker}
                  className="glass-card rounded-xl p-6 group cursor-pointer relative overflow-hidden bg-white/5 border border-white/5 hover:border-emerald-500/30 transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]"
                  onClick={() => onAddToPortfolio(etf)}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded border border-emerald-500/30 font-bold backdrop-blur-sm">
                      ADD +
                    </div>
                  </div>

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-white tracking-tight">{etf.ticker}</h3>
                      <p className="text-sm text-neutral-400 line-clamp-1" title={etf.name}>{etf.name}</p>
                    </div>
                    <div className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded text-sm font-medium",
                      isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    )}>
                      {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {Math.abs(etf.changePercent).toFixed(2)}%
                    </div>
                  </div>

                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <div className="text-3xl font-light text-white">{formatCurrency(etf.price)}</div>
                      <div className="text-xs text-neutral-500 mt-1">Closing Price</div>
                    </div>
                    {etf.history && etf.history.length > 0 && (
                        <Sparkline
                        data={etf.history}
                        color={isPositive ? '#10b981' : '#f43f5e'}
                        />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div>
                      <div className="text-xs text-neutral-500 mb-1">Yield</div>
                      <div className="text-sm font-medium text-emerald-400">{etf.metrics.yield?.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-neutral-500 mb-1">MER</div>
                      <div className="text-sm font-medium text-neutral-300">{etf.metrics.mer?.toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {etfs.length === 0 && !loading && (
                <div className="col-span-full text-center text-neutral-500 py-12 flex flex-col items-center">
                    <Search className="h-12 w-12 text-neutral-700 mb-4" />
                    <p>No ETFs found matching "{search}"</p>
                    <p className="text-sm text-neutral-600 mt-2">Try a different ticker (e.g., "VFV", "SPY")</p>
                </div>
            )}
          </div>
        )}
      </motion.div>
    </section>
  );
}
