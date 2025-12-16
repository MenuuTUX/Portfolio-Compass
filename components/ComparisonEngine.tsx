'use client';

import { useState, useEffect, useCallback, useRef, useMemo, memo, useId } from 'react';
import { Search, ArrowUpRight, ArrowDownRight, Maximize2, Plus, Check, Trash2, ChevronDown } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { cn, formatCurrency } from '@/lib/utils';
import { getProviderLogo } from '@/lib/etf-providers';
import { ETF, PortfolioItem } from '@/types';
import { ETFSchema } from '@/schemas/assetSchema';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import ETFDetailsDrawer from './ETFDetailsDrawer';
import MessageDrawer from './MessageDrawer';

interface SparklineProps {
  data: { date: string; price: number }[];
  color: string;
}

// Sparkline component - Memoized to prevent re-renders on parent updates
const Sparkline = memo(({ data, color }: SparklineProps) => {
  const uniqueId = useId();
  // Using a unique ID ensures gradient definitions don't collide between multiple charts
  const gradientId = `gradient-${uniqueId}`;

  return (
    <div className="h-16 w-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <table className="sr-only">
        <caption>Price History Sparkline</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Price</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr key={i}>
              <td>{new Date(item.date).toLocaleDateString()}</td>
              <td>{formatCurrency(item.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

Sparkline.displayName = 'Sparkline';

interface ETFCardProps {
  etf: ETF;
  inPortfolio: boolean;
  flashState: 'success' | 'error' | null;
  syncingTicker: string | null;
  onAdd: (etf: ETF) => void;
  onRemove: (ticker: string) => void;
  onView: (etf: ETF) => void;
}

// ETFCard component - Memoized to isolate state updates (like flash animations)
const ETFCard = memo(({
  etf,
  inPortfolio,
  flashState,
  syncingTicker,
  onAdd,
  onRemove,
  onView
}: ETFCardProps) => {
  const isPositive = etf.changePercent >= 0;

  // Determine graph color based on history trend if available
  let isGraphPositive = isPositive;
  if (etf.history && etf.history.length > 0) {
    const firstPrice = etf.history[0].price;
    const lastPrice = etf.history[etf.history.length - 1].price;
    isGraphPositive = lastPrice >= firstPrice;
  }

  return (
    <div
      className={cn(
        "glass-card rounded-xl relative overflow-hidden bg-white/5 border transition-all group flex flex-col",
        inPortfolio
          ? "border-emerald-500/30 shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)]"
          : "border-white/5 hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]"
      )}
    >
      {/* Flash Overlay */}
      <AnimatePresence>
        {flashState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "absolute inset-0 z-20 pointer-events-none backdrop-blur-[2px]",
              flashState === 'success' ? "bg-emerald-500/20" : "bg-rose-500/20"
            )}
          />
        )}
      </AnimatePresence>

      {/* Green Blur Overlay for Owned Items */}
      {inPortfolio && (
        <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />
      )}

      <div className="p-6 transition-all duration-300 md:group-hover:blur-sm md:group-hover:opacity-30 flex-1">
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-3">
             {/* Provider Logo */}
             {getProviderLogo(etf.name) && (
              <div className="w-10 h-10 rounded-lg bg-white p-1.5 flex items-center justify-center shrink-0">
                <img
                  src={getProviderLogo(etf.name)!}
                  alt={`${etf.name} logo`}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
            )}
            <div>
              <h3 className="text-2xl font-bold text-white tracking-tight">{etf.ticker}</h3>
              <p className="text-sm text-neutral-400 line-clamp-1" title={etf.name}>{etf.name}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Owned Indicator */}
            {inPortfolio && (
              <div className="flex items-center gap-1 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                <Check className="w-3 h-3" />
                OWNED
              </div>
            )}
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-sm font-medium",
              isGraphPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
            )}>
              {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(etf.changePercent).toFixed(2)}%
            </div>
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
              color={isGraphPositive ? '#10b981' : '#f43f5e'}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
          <div>
            <div className="text-xs text-neutral-500 mb-1">Yield</div>
            <div className="text-sm font-medium text-emerald-400">{etf.metrics?.yield?.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500 mb-1">MER</div>
            <div className="text-sm font-medium text-neutral-300">{etf.metrics?.mer?.toFixed(2)}%</div>
          </div>
        </div>
      </div>

      {/* Mobile Actions (Visible by default) */}
      <div className="flex md:hidden border-t border-white/10 divide-x divide-white/10">
        {inPortfolio ? (
          <button
            onClick={() => onRemove(etf.ticker)}
            className="flex-1 py-3 bg-rose-500/10 text-rose-400 font-medium flex items-center justify-center gap-2 active:bg-rose-500/20"
          >
            <Trash2 className="w-4 h-4" /> Remove
          </button>
        ) : (
          <button
            onClick={() => onAdd(etf)}
            className="flex-1 py-3 bg-emerald-500/10 text-emerald-400 font-medium flex items-center justify-center gap-2 active:bg-emerald-500/20"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        )}
        <button
          onClick={() => onView(etf)}
          disabled={syncingTicker === etf.ticker}
          className="flex-1 py-3 bg-white/5 text-white font-medium flex items-center justify-center gap-2 active:bg-white/10 disabled:opacity-50"
        >
          {syncingTicker === etf.ticker ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
          View
        </button>
      </div>

      {/* Desktop Overlay (Hover only) */}
      <div className="hidden md:flex absolute inset-0 flex-col items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none group-hover:pointer-events-auto bg-black/60 backdrop-blur-sm">
        {inPortfolio ? (
          <button
            onClick={() => onRemove(etf.ticker)}
            className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-6 rounded-full flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-75 shadow-lg shadow-rose-500/20"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </button>
        ) : (
          <button
            onClick={() => onAdd(etf)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-6 rounded-full flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-75 shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            Add to Portfolio
          </button>
        )}
        <button
          onClick={() => onView(etf)}
          disabled={syncingTicker === etf.ticker}
          className="bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-6 rounded-full flex items-center gap-2 backdrop-blur-md border border-white/10 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncingTicker === etf.ticker ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
          {syncingTicker === etf.ticker ? 'Syncing...' : 'Advanced View'}
        </button>
      </div>

    </div>
  );
});

ETFCard.displayName = 'ETFCard';

interface ComparisonEngineProps {
  onAddToPortfolio: (etf: ETF) => void;
  onRemoveFromPortfolio: (ticker: string) => void;
  portfolio: PortfolioItem[];
  assetType?: string;
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

export default function ComparisonEngine({ onAddToPortfolio, onRemoveFromPortfolio, portfolio = [], assetType }: ComparisonEngineProps) {
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [otherTypeEtfs, setOtherTypeEtfs] = useState<ETF[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ETF[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedETF, setSelectedETF] = useState<ETF | null>(null);
  const [syncingTicker, setSyncingTicker] = useState<string | null>(null);
  const [messageDrawer, setMessageDrawer] = useState<{ isOpen: boolean; title: string; message: string; type: 'error' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });
  const [flashStates, setFlashStates] = useState<Record<string, 'success' | 'error' | null>>({});

  // Pagination and sorting state
  const [visibleCount, setVisibleCount] = useState(12);
  const [recentTickers, setRecentTickers] = useState<string[]>([]);

  // Load recent tickers on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recent_tickers');
      if (stored) {
        setRecentTickers(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load recent tickers", e);
    }
  }, []);

  const addToRecent = useCallback((ticker: string) => {
    setRecentTickers(prev => {
      const newRecent = [ticker, ...prev.filter(t => t !== ticker)].slice(0, 50);
      try {
        localStorage.setItem('recent_tickers', JSON.stringify(newRecent));
      } catch (e) {
        console.error("Failed to save recent tickers", e);
      }
      return newRecent;
    });
  }, []);

  const triggerFlash = useCallback((ticker: string, type: 'success' | 'error') => {
    setFlashStates(prev => ({ ...prev, [ticker]: type }));
    setTimeout(() => {
      setFlashStates(prev => ({ ...prev, [ticker]: null }));
    }, 500);
  }, []);

  const handleAdd = useCallback((etf: ETF) => {
    onAddToPortfolio(etf);
    triggerFlash(etf.ticker, 'success');
  }, [onAddToPortfolio, triggerFlash]);

  const handleRemove = useCallback((ticker: string) => {
    onRemoveFromPortfolio(ticker);
    triggerFlash(ticker, 'error');
  }, [onRemoveFromPortfolio, triggerFlash]);

  const isInPortfolio = (ticker: string) => portfolio.some(item => item.ticker === ticker);

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
      // We pass the type as a hint to the backend (though backend might search broadly now)
      // ComparisonEngine requires history for Sparklines, so we explicitly request it.
      let url = `/api/etfs/search?query=${encodeURIComponent(query)}&includeHistory=true`;
      if (assetType) {
        url += `&type=${encodeURIComponent(assetType)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      const rawData = await res.json();

      let data: ETF[] = [];
      try {
        data = z.array(ETFSchema).parse(rawData);
      } catch (e) {
         if (e instanceof z.ZodError) {
          console.warn('API response validation failed:', e.issues);
        } else {
            console.warn('API response validation failed:', e);
        }
        data = rawData as ETF[];
      }

      // Filter results on client side
      if (assetType) {
        const valid = data.filter(item => item.assetType === assetType);
        const other = data.filter(item => item.assetType !== assetType);

        setEtfs(valid);
        setOtherTypeEtfs(other);

        // For suggestions, we might want to show everything but maybe visually distinguish?
        // Or strictly follow the section rules.
        // Let's filter suggestions to strict matches for now.
        setSuggestions(valid);
      } else {
        setEtfs(data);
        setSuggestions(data);
        setOtherTypeEtfs([]);
      }

    } catch (err) {
      console.error("Failed to load ETF data", err);
      setEtfs([]);
      setSuggestions([]);
      setOtherTypeEtfs([]);
    } finally {
      setLoading(false);
    }
  }, [assetType]);

  // Effect for main search/grid
  useEffect(() => {
    fetchEtfs(debouncedSearch);
  }, [debouncedSearch, fetchEtfs]);

  // Reset pagination when search or asset type changes
  useEffect(() => {
    setVisibleCount(12);
  }, [debouncedSearch, assetType]);

  // Effect to handle "No Results Found" drawer (Search returns 0)
  // We only trigger this if search is active (debouncedSearch) and both lists are empty.
  useEffect(() => {
    if (!loading && debouncedSearch && etfs.length === 0 && otherTypeEtfs.length === 0) {
      // Only open if not already open to avoid loop/spam
      // But we can't check 'isOpen' inside the effect dependency easily without cause re-renders.
      // We'll trust that debouncedSearch changes infrequently.
      setMessageDrawer({
        isOpen: true,
        title: 'No Results Found',
        message: `No ${assetType === 'STOCK' ? 'Stocks' : 'ETFs'} found matching "${debouncedSearch}".`,
        type: 'info'
      });
    }
  }, [loading, debouncedSearch, etfs, otherTypeEtfs, assetType]);

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
  };

  const handleAdvancedView = useCallback(async (etf: ETF) => {
    addToRecent(etf.ticker);
    if (etf.isDeepAnalysisLoaded) {
      setSelectedETF(etf);
      return;
    }

    setSyncingTicker(etf.ticker);
    try {
      const res = await fetch('/api/etfs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: etf.ticker }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));

        if (res.status === 404 && errorData.deleted) {
          setEtfs(prev => prev.filter(e => e.ticker !== etf.ticker));
          setMessageDrawer({
            isOpen: true,
            title: 'Ticker Not Found',
            message: `Ticker ${etf.ticker} was not found and has been removed from your list.`,
            type: 'error'
          });
          return;
        }

        console.error("Sync failed response:", JSON.stringify(errorData));
        throw new Error(`Sync failed: ${res.status} ${res.statusText}`);
      }

      const rawUpdatedEtf = await res.json();
      let updatedEtf: ETF;
      try {
        updatedEtf = ETFSchema.parse(rawUpdatedEtf);
      } catch (e) {
         if (e instanceof z.ZodError) {
          console.warn('API response validation failed:', e.issues);
        } else {
            console.warn('API response validation failed:', e);
        }
        updatedEtf = rawUpdatedEtf as ETF;
      }

      // Update local state
      setEtfs(prev => prev.map(e => e.ticker === updatedEtf.ticker ? updatedEtf : e));
      setSelectedETF(updatedEtf);
    } catch (err: any) {
      console.error('Failed to sync ETF details', err);
      // If network error or other sync error, we could show a message too
    } finally {
      setSyncingTicker(null);
    }
  }, [addToRecent]); // addToRecent is stable (useCallback)

  const renderNoResults = () => {
    if (loading) return null;

    // Case 1: Found items but in the other section
    if (etfs.length === 0 && otherTypeEtfs.length > 0) {
      const otherSection = assetType === 'STOCK' ? 'ETFs' : 'Stocks';
      const sample = otherTypeEtfs[0].ticker;
      // Fixed phrasing: handle singular vs plural
      const othersCount = otherTypeEtfs.length - 1;
      const othersText = othersCount > 0
        ? `and ${othersCount} other${othersCount === 1 ? '' : 's'}`
        : '';

      return (
        <div className="col-span-full text-center text-neutral-500 py-12 flex flex-col items-center">
          <Search className="h-12 w-12 text-emerald-400 mb-4" />
          <p className="text-lg text-white mb-2">Found matches in {otherSection}</p>
          <p className="text-neutral-400">
            We found "{sample}"{othersText ? ` ${othersText}` : ''} in the {otherSection} section.
          </p>
          <p className="text-sm text-neutral-500 mt-2">
            Please switch to the {otherSection} tab to view these assets.
          </p>
        </div>
      );
    }

    // Case 2: No items found anywhere
    // Now handled by the MessageDrawer via useEffect.
    // Return null to show empty grid (which will be blurred by drawer backdrop)
    if (etfs.length === 0) {
      return null;
    }

    return null;
  };

  const handleDrawerClose = () => {
    setMessageDrawer(prev => ({ ...prev, isOpen: false }));
    // Optionally clear search to reset view, "Allow users to go back"
    // "Go Back" usually means return to previous state.
    // If we leave search text, they see empty grid.
    // If we clear search, they see the list again.
    // Let's clear search.
    if (messageDrawer.type === 'info' && search) {
      setSearch('');
    }
  };

  // Sort ETFs: Recent first, then original order
  const sortedEtfs = useMemo(() => {
    if (recentTickers.length === 0) return etfs;
    return [...etfs].sort((a, b) => {
      const indexA = recentTickers.indexOf(a.ticker);
      const indexB = recentTickers.indexOf(b.ticker);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });
  }, [etfs, recentTickers]);

  const displayedEtfs = sortedEtfs.slice(0, visibleCount);

  return (
    <section className="py-12 md:py-24 px-4 max-w-7xl mx-auto h-[calc(100dvh-64px)] overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 md:mb-12 gap-6">
          <div className="w-full md:w-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Market Engine</h2>
            <p className="text-sm md:text-base text-neutral-400">Real-time analysis of leading {assetType === 'STOCK' ? 'Stocks' : 'ETFs'}. Click to add to builder.</p>
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
                onChange={(e) => {
                  const value = e.target.value.toUpperCase().replace(/[^A-Z.]/g, '');
                  setSearch(value);
                }}
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
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
            {displayedEtfs.map((etf) => (
              <ETFCard
                key={etf.ticker}
                etf={etf}
                inPortfolio={isInPortfolio(etf.ticker)}
                flashState={flashStates[etf.ticker]}
                syncingTicker={syncingTicker}
                onAdd={handleAdd}
                onRemove={handleRemove}
                onView={handleAdvancedView}
              />
            ))}
            {renderNoResults()}

            {/* Load More Button */}
            {displayedEtfs.length < etfs.length && (
              <div className="col-span-full flex justify-center mt-8">
                <button
                  onClick={() => setVisibleCount(prev => prev + 12)}
                  className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all border border-white/10 hover:border-emerald-500/50"
                >
                  <ChevronDown className="w-4 h-4" />
                  Load More ({etfs.length - displayedEtfs.length} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
      <ETFDetailsDrawer etf={selectedETF} onClose={() => setSelectedETF(null)} />
      <MessageDrawer
        isOpen={messageDrawer.isOpen}
        onClose={handleDrawerClose}
        title={messageDrawer.title}
        message={messageDrawer.message}
        type={messageDrawer.type}
      />
    </section>
  );
}
