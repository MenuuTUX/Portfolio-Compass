'use client';

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { Search, ArrowUpRight, ArrowDownRight, Maximize2, Plus, Check, Trash2, Loader2, ChevronDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { cn, formatCurrency } from '@/lib/utils';
import { ETF, PortfolioItem } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import ETFDetailsDrawer from './ETFDetailsDrawer';
import MessageDrawer from './MessageDrawer';
import AutoSizer from 'react-virtualized-auto-sizer';
import { List as FixedSizeList } from 'react-window';

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

interface SparklineProps {
  data: { date: string; price: number }[];
  color: string;
}

// Sparkline component (Memoized)
const Sparkline = memo(({ data, color }: SparklineProps) => {
  // Optimization: Downsample data if too large for a small sparkline
  const chartData = useMemo(() => {
    if (data.length > 50) {
       const step = Math.ceil(data.length / 50);
       return data.filter((_, i) => i % step === 0);
    }
    return data;
  }, [data]);

  return (
    <div className="h-16 w-32">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Line
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

Sparkline.displayName = 'Sparkline';

interface ComparisonCardProps {
  etf: ETF;
  inPortfolio: boolean;
  flashState: 'success' | 'error' | null;
  syncingTicker: string | null;
  onAdd: (etf: ETF) => void;
  onRemove: (ticker: string) => void;
  onView: (etf: ETF) => void;
  style?: React.CSSProperties;
}

const ComparisonCard = memo(({ etf, inPortfolio, flashState, syncingTicker, onAdd, onRemove, onView, style }: ComparisonCardProps) => {
  const isPositive = etf.changePercent >= 0;

  return (
    <div
      style={style}
      className={cn(
        "glass-card rounded-xl relative overflow-hidden bg-white/5 border transition-all group flex flex-col h-full",
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

      <div className="p-6 transition-all duration-300 md:group-hover:blur-sm md:group-hover:opacity-30 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-2xl font-bold text-white tracking-tight">{etf.ticker}</h3>
              <p className="text-sm text-neutral-400 line-clamp-1" title={etf.name}>{etf.name}</p>
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
                isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
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
                color={isPositive ? '#10b981' : '#f43f5e'}
              />
            )}
          </div>
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

ComparisonCard.displayName = 'ComparisonCard';

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
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

  const fetchEtfs = useCallback(async (query: string, pageToFetch: number, reset: boolean = false) => {
    if (pageToFetch === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      let url = `/api/etfs/search?query=${encodeURIComponent(query)}&page=${pageToFetch}&limit=20`;
      if (assetType) {
        url += `&type=${encodeURIComponent(assetType)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      const data: ETF[] = await res.json();

      if (assetType) {
        // API handles filtering, but we might still get mixed if we didn't pass type (which we do now).
        // Let's assume API returns correct type.
        const valid = data;

        if (reset) {
            setEtfs(valid);
            setPage(pageToFetch);
        } else {
            setEtfs(prev => [...prev, ...valid]);
            setPage(pageToFetch);
        }

        // Suggestions only on initial search
        if (pageToFetch === 1 && query) {
            setSuggestions(valid);
        }

        if (valid.length < 20) {
            setHasMore(false);
        } else {
            setHasMore(true);
        }
      }

    } catch (err) {
      console.error("Failed to load ETF data", err);
      if (reset) setEtfs([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [assetType]);

  // Initial fetch and Search change
  useEffect(() => {
    fetchEtfs(debouncedSearch, 1, true);
  }, [debouncedSearch, fetchEtfs]);

  // Handle Load More
  const handleLoadMore = useCallback(() => {
      if (!loadingMore && hasMore) {
          fetchEtfs(debouncedSearch, page + 1, false);
      }
  }, [loadingMore, hasMore, page, debouncedSearch, fetchEtfs]);

  useEffect(() => {
    if (!loading && debouncedSearch && etfs.length === 0 && otherTypeEtfs.length === 0) {
      // Logic for "No Results" drawer.
      // We might want to suppress this if we are just paging, but this effect runs on dependency changes.
      // It's safe as long as we check loading.
      // Re-implement the otherType logic if needed, but the API now filters by type so we won't get "other type" results in the main call.
      // If we want to suggest other types, we'd need a separate call. For now simplified.
       setMessageDrawer({
        isOpen: true,
        title: 'No Results Found',
        message: `No ${assetType === 'STOCK' ? 'Stocks' : 'ETFs'} found matching "${debouncedSearch}".`,
        type: 'info'
      });
    }
  }, [loading, debouncedSearch, etfs.length, otherTypeEtfs.length, assetType]); // Added lengths to deps to avoid loops

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
        throw new Error(`Sync failed: ${res.status}`);
      }

      const updatedEtf: ETF = await res.json();
      setEtfs(prev => prev.map(e => e.ticker === updatedEtf.ticker ? updatedEtf : e));
      setSelectedETF(updatedEtf);
    } catch (err: any) {
      console.error('Failed to sync ETF details', err);
    } finally {
      setSyncingTicker(null);
    }
  }, []);

  const handleDrawerClose = () => {
    setMessageDrawer(prev => ({ ...prev, isOpen: false }));
    if (messageDrawer.type === 'info' && search) {
      setSearch('');
    }
  };

  const renderNoResults = () => {
    if (loading) return null;
    return (
        <div className="text-center text-neutral-500 py-12 flex flex-col items-center">
          <Search className="h-12 w-12 text-emerald-400 mb-4" />
          <p className="text-lg text-white mb-2">No matches found</p>
          <p className="text-neutral-400">
            Try a different search term.
          </p>
        </div>
      );
  };

  // Virtualization Cell Renderer
  const Cell = useCallback(({ index, style, ...props }: any) => {
    const { items, columnCount, portfolio, flashStates, syncingTicker, onAdd, onRemove, onView } = props;

    // index is the ROW index
    const rowItems = [];
    if (items && columnCount) {
        for (let i = 0; i < columnCount; i++) {
            const itemIndex = index * columnCount + i;
            if (itemIndex < items.length) {
                rowItems.push(items[itemIndex]);
            }
        }
    }

    return (
       <div style={style} className="flex gap-6 pb-6 px-1">
           {rowItems.map((etf: ETF) => (
               <div key={etf.ticker} className="flex-1 min-w-0">
                   <ComparisonCard
                       etf={etf}
                       inPortfolio={portfolio.some((p: any) => p.ticker === etf.ticker)}
                       flashState={flashStates[etf.ticker]}
                       syncingTicker={syncingTicker}
                       onAdd={onAdd}
                       onRemove={onRemove}
                       onView={onView}
                       style={{ height: '100%' }}
                   />
               </div>
           ))}
           {/* Filler for empty slots in last row */}
           {rowItems.length < columnCount &&
               Array.from({ length: columnCount - rowItems.length }).map((_, i) => (
                   <div key={`empty-${i}`} className="flex-1" />
               ))
           }
       </div>
    );
  }, []);

  return (
    <section className="py-12 md:py-24 px-4 max-w-7xl mx-auto h-[calc(100dvh-64px)] flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex-shrink-0"
      >
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 md:mb-12 gap-6">
          <div className="w-full md:w-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Market Engine</h2>
            <p className="text-sm md:text-base text-neutral-400">Real-time analysis of leading {assetType === 'STOCK' ? 'Stocks' : 'ETFs'}. Click to add to builder.</p>
          </div>

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
      </motion.div>

      <div className="flex-1 w-full min-h-0 relative flex flex-col">
        {loading ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : etfs.length > 0 ? (
          <>
          <div className="flex-1">
          <AutoSizer>
            {({ height, width }: { height: number; width: number }) => {
              // Determine columns based on width
              let columnCount = 1;
              if (width >= 1024) columnCount = 3; // lg
              else if (width >= 768) columnCount = 2; // md

              const rowCount = Math.ceil(etfs.length / columnCount);
              const cardHeight = 350; // Approximated card height + gap

              return (
                 <FixedSizeList
                   style={{ height, width }}
                   rowCount={rowCount}
                   rowHeight={cardHeight}
                   rowComponent={Cell}
                   rowProps={{
                     items: etfs,
                     portfolio,
                     flashStates,
                     syncingTicker,
                     onAdd: handleAdd,
                     onRemove: handleRemove,
                     onView: handleAdvancedView,
                     columnCount
                   }}
                 />
              );
            }}
          </AutoSizer>
          </div>
          {/* Load More Button */}
          {hasMore && (
              <div className="flex justify-center py-4 shrink-0">
                  <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-medium py-2 px-6 rounded-full border border-white/10 transition-all disabled:opacity-50"
                  >
                      {loadingMore ? (
                          <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Loading...
                          </>
                      ) : (
                          <>
                              <ChevronDown className="w-4 h-4" />
                              Load More
                          </>
                      )}
                  </button>
              </div>
          )}
          </>
        ) : (
          renderNoResults()
        )}
      </div>

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
