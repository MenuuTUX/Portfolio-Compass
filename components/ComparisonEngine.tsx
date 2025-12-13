'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { ETF, PortfolioItem } from '@/types';
import { ETFSchema } from '@/schemas/assetSchema';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import ETFDetailsDrawer from './ETFDetailsDrawer';
import MessageDrawer from './MessageDrawer';
import { ETFCard } from './ETFCard';
import useWindowSize from '@/hooks/useWindowSize';

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

  // Virtualizer setup
  const parentRef = useRef<HTMLElement>(null);
  const { width } = useWindowSize();

  // Determine number of columns based on width
  const columns = useMemo(() => {
    if (!width) return 1; // Default to 1 (mobile-first) or 3 if assuming desktop
    if (width >= 1024) return 3;
    if (width >= 768) return 2;
    return 1;
  }, [width]);

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil((etfs.length || 0) / columns),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 350, // Approximate card height (320px + gap)
    overscan: 5,
  });

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

  const isInPortfolio = useCallback((ticker: string) => portfolio.some(item => item.ticker === ticker), [portfolio]);

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
      let url = `/api/etfs/search?query=${encodeURIComponent(query)}`;
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
        // Let's filter suggestions too to avoid confusion in the dropdown,
        // OR show them but they won't appear in the grid.
        // Given the requirement "Stocks don't appear in the etf section",
        // let's filter suggestions to strict matches for now.
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
  }, []);

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

  return (
    <section
      ref={parentRef}
      className="py-12 md:py-24 px-4 max-w-7xl mx-auto h-[calc(100dvh-64px)] overflow-y-auto"
    >
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
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
              marginBottom: '5rem' // pb-20 equivalent
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const startIndex = virtualRow.index * columns;
              const rowEtfs = etfs.slice(startIndex, startIndex + columns);

              return (
                <div
                  key={virtualRow.index}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {rowEtfs.map((etf) => (
                     <ETFCard
                        key={etf.ticker}
                        etf={etf}
                        inPortfolio={isInPortfolio(etf.ticker)}
                        flashState={flashStates[etf.ticker] || null}
                        syncingTicker={syncingTicker}
                        onAdd={handleAdd}
                        onRemove={handleRemove}
                        onAdvancedView={handleAdvancedView}
                     />
                  ))}
                </div>
              );
            })}
            {renderNoResults()}
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
