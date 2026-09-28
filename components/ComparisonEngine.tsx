"use client";

import Image from "next/image";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from "react";
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2,
  Plus,
  Check,
  Trash2,
  ChevronDown,
  Filter,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { getAssetIconUrl } from "@/lib/etf-providers";
import { ETF, PortfolioItem } from "@/types";
import { ETFSchema } from "@/schemas/assetSchema";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import ETFDetailsDrawer from "./ETFDetailsDrawer";
import MessageDrawer from "./MessageDrawer";
import Sparkline from "./Sparkline";
import { HelpTip } from "./ui/HelpTip";
import { describeYieldProvenance, getSourcedYield } from "@/lib/yield-provenance";
import { describeExpenseRatioProvenance, getSourcedExpenseRatio } from "@/lib/fee-provenance";
import MarketFilters, {
  DEFAULT_MARKET_FILTERS,
  MarketFilterState,
  applyMarketFilters,
} from "./MarketFilters";

interface ETFCardProps {
  etf: ETF;
  inPortfolio: boolean;
  flashState: "success" | "error" | null;
  onAdd: (etf: ETF) => void;
  onRemove: (ticker: string) => void;
  onView: (etf: ETF) => void;
}

// ETFCard component - Memoized to isolate state updates (like flash animations)
const ETFCard = memo(
  ({
    etf,
    inPortfolio,
    flashState,
    onAdd,
    onRemove,
    onView,
  }: ETFCardProps) => {
    const isPositive = etf.changePercent >= 0;
    const yieldValue = getSourcedYield(etf.metrics, etf.dividendYield);
    const yieldKnown = yieldValue != null;
    const quoteUnavailable = etf.quoteStatus === "unavailable";
    const quoteTime = etf.quoteAsOf && Number.isFinite(Date.parse(etf.quoteAsOf))
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(etf.quoteAsOf))
      : null;

    const displayHistory = etf.history ?? [];

    // Determine graph color based on history trend if available
    let isGraphPositive = isPositive;
    if (displayHistory && displayHistory.length > 0) {
      const firstPrice = displayHistory[0].price;
      const lastPrice = displayHistory[displayHistory.length - 1].price;
      isGraphPositive = lastPrice >= firstPrice;
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={flashState ? { x: [0, -5, 5, -5, 5, 0], opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={cn(
          "glass-card rounded-xl relative overflow-hidden bg-surface-card border transition-all group flex flex-col",
          inPortfolio ? "border-emerald-500/30 shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)]" : "border-hairline hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]",
        )}
      >
        <div className="p-6 transition-all duration-300 md:group-hover:blur-sm md:group-hover:opacity-30 flex-1">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-3">
              {/* Provider Logo */}
              {getAssetIconUrl(etf.ticker, etf.name, etf.assetType) && <div className="w-10 h-10 flex items-center justify-center shrink-0"><Image src={getAssetIconUrl(etf.ticker, etf.name, etf.assetType)!} alt={`${etf.ticker} logo`} width={40} height={40} className="w-full h-full object-contain" /></div>}
              <div>
                <h3 className="text-2xl font-bold text-ink tracking-tight">
                  {etf.ticker}
                </h3>
                <p
                  className="text-sm text-neutral-400 line-clamp-1"
                  title={etf.name}
                >
                  {etf.name}
                </p>
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
              <div
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-sm font-medium",
                  quoteUnavailable
                    ? "bg-surface-soft text-muted"
                    : isPositive
                    ? "bg-surface-soft text-data-up"
                    : "bg-surface-soft text-data-down",
                )}
              >
                {!quoteUnavailable && (isPositive ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                ))}
                {quoteUnavailable ? "Change unavailable" : `Daily ${etf.changePercent > 0 ? "+" : etf.changePercent < 0 ? "−" : ""}${Math.abs(etf.changePercent).toFixed(2)}%`}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-end mb-6">
            <div>
              <div className="text-3xl font-light text-ink">
                {quoteUnavailable ? "Unavailable" : formatCurrency(etf.price, etf.currency)}
              </div>
              <div className="text-xs text-muted mt-1">
                {quoteUnavailable ? "Quote unavailable" : quoteTime ? `Quote as of ${quoteTime}` : "Quote time unavailable"}
              </div>
            </div>
            {displayHistory.length > 0 && (
              <Sparkline
                data={displayHistory}
                color={isGraphPositive ? "#5cb883" : "#ef7a72"}
                name={etf.ticker}
              />
            )}
            {displayHistory.length === 0 && (
              <span className="text-xs text-neutral-400">Chart unavailable</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-hairline">
            <div>
              <div className="text-xs text-neutral-400 mb-1">
                <HelpTip term={etf.metrics?.yieldSource === "Yahoo Finance quote" ? "Unverified Yahoo dividend yield unavailable" : "Dividend yield"} showIcon={false} />
              </div>
              <div
                className="text-sm font-medium text-muted"
                title={describeYieldProvenance(etf.metrics?.yieldSource, etf.metrics?.yieldRetrievedAt, etf.metrics?.yieldSourceField, etf.metrics?.yieldInputUnit, etf.metrics?.yieldNormalization, etf.metrics?.yieldMeasurementDate)}
              >
                {!yieldKnown
                  ? "N/A"
                  : `${yieldValue!.toFixed(2)}%`}
              </div>
              {yieldKnown && etf.metrics?.yieldSource === "Yahoo Finance quote" && (
                <div className="text-[10px] text-neutral-500 mt-0.5">Provider-reported · unverified</div>
              )}
            </div>
            {/* Expense ratios apply to funds and ETFs, not individual stocks. */}
            {etf.assetType === "STOCK" ? (
              <div>
                <div className="text-xs text-neutral-400 mb-1">
                  <HelpTip term="PE Ratio" showIcon={false} />
                </div>
                <div className="text-sm font-medium text-neutral-300">
                  {etf.peRatio != null && etf.peRatio > 0
                    ? etf.peRatio.toFixed(1)
                    : "N/A"}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xs text-neutral-400 mb-1">
                  <span>Expense ratio (provider-reported)</span>
                </div>
                <div
                  className="text-sm font-medium text-neutral-300"
                  title={describeExpenseRatioProvenance(etf.metrics)}
                >
                  {getSourcedExpenseRatio(etf.metrics) != null
                    ? `${getSourcedExpenseRatio(etf.metrics)!.toFixed(2)}%`
                    : "N/A"}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex md:hidden border-t border-hairline divide-x divide-hairline">
          {inPortfolio ? <button onClick={() => onRemove(etf.ticker)} className="flex-1 py-3 bg-rose-500/10 text-rose-400 font-medium flex items-center justify-center gap-2 active:bg-rose-500/20"><Trash2 className="w-4 h-4" /> Remove</button> : <button onClick={() => onAdd(etf)} className="flex-1 py-3 bg-emerald-500/10 text-emerald-400 font-medium flex items-center justify-center gap-2 active:bg-emerald-500/20"><Plus className="w-4 h-4" /> Add</button>}
          <button onClick={() => onView(etf)} className="flex-1 py-3 bg-surface-card text-ink font-medium flex items-center justify-center gap-2 active:bg-surface-soft"><Maximize2 className="w-4 h-4" /> View</button>
        </div>
        <div className="hidden md:flex absolute inset-0 flex-col items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none group-hover:pointer-events-auto bg-dune/40 backdrop-blur-sm">
          {inPortfolio ? <button onClick={() => onRemove(etf.ticker)} className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-6 rounded-full flex items-center gap-2 shadow-lg shadow-rose-500/20"><Trash2 className="w-4 h-4" />Remove</button> : <button onClick={() => onAdd(etf)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-6 rounded-full flex items-center gap-2 shadow-lg shadow-emerald-500/20"><Plus className="w-4 h-4" />Add to Portfolio</button>}
          <button onClick={() => onView(etf)} className="bg-surface-soft text-ink font-medium py-2 px-6 rounded-full flex items-center gap-2 backdrop-blur-md border border-hairline"><Maximize2 className="w-4 h-4" />Advanced View</button>
        </div>
      </motion.div>
    );
  },
);

ETFCard.displayName = "ETFCard";

interface ComparisonEngineProps {
  onAddToPortfolio: (etf: ETF) => Promise<void>;
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

export default function ComparisonEngine({
  onAddToPortfolio,
  onRemoveFromPortfolio,
  portfolio = [],
  assetType,
}: ComparisonEngineProps) {
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [otherTypeEtfs, setOtherTypeEtfs] = useState<ETF[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ETF[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedETF, setSelectedETF] = useState<ETF | null>(null);
  const [messageDrawer, setMessageDrawer] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "error" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });
  const [flashStates, setFlashStates] = useState<
    Record<string, "success" | "error" | null>
  >({});

  // Pagination and sorting state
  const [visibleCount, setVisibleCount] = useState(24);
  const [hasMoreServer, setHasMoreServer] = useState(true);
  const [recentTickers, setRecentTickers] = useState<string[]>([]);
  const [filters, setFilters] = useState<MarketFilterState>({
    ...DEFAULT_MARKET_FILTERS,
  });

  // Load recent tickers on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("recent_tickers");
      if (stored) {
        setRecentTickers(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load recent tickers", e);
    }
  }, []);

  const addToRecent = useCallback((ticker: string) => {
    setRecentTickers((prev) => {
      const newRecent = [ticker, ...prev.filter((t) => t !== ticker)].slice(
        0,
        50,
      );
      try {
        localStorage.setItem("recent_tickers", JSON.stringify(newRecent));
      } catch (e) {
        console.error("Failed to save recent tickers", e);
      }
      return newRecent;
    });
  }, []);

  const triggerFlash = useCallback(
    (ticker: string, type: "success" | "error") => {
      setFlashStates((prev) => ({ ...prev, [ticker]: type }));
      setTimeout(() => {
        setFlashStates((prev) => ({ ...prev, [ticker]: null }));
      }, 500);
    },
    [],
  );

  const handleAdd = useCallback(
    async (etf: ETF) => {
      try {
        await onAddToPortfolio(etf);
        triggerFlash(etf.ticker, "success");
      } catch (error) {
        console.error("Failed to add to portfolio", error);
        triggerFlash(etf.ticker, "error");
        const detail =
          error instanceof Error && error.message
            ? error.message
            : "Could not add asset to portfolio. Please try again.";
        setMessageDrawer({
          isOpen: true,
          title: "Add Failed",
          message: detail,
          type: "error",
        });
      }
    },
    [onAddToPortfolio, triggerFlash],
  );

  const handleRemove = useCallback(
    (ticker: string) => {
      onRemoveFromPortfolio(ticker);
      triggerFlash(ticker, "error");
    },
    [onRemoveFromPortfolio, triggerFlash],
  );

  const isInPortfolio = (ticker: string) =>
    portfolio.some(
      (item) => item.ticker.toUpperCase() === ticker.toUpperCase(),
    );

  const searchContainerRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(search, 500);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (
        searchContainerRef.current &&
        target instanceof Node &&
        !searchContainerRef.current.contains(target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchEtfs = useCallback(
    async (query: string, skip = 0) => {
      if (skip === 0) setLoading(true);
      try {
        let url = `/api/market/search?query=${encodeURIComponent(query)}&skip=${skip}&limit=24`;
        if (assetType) {
          url += `&type=${encodeURIComponent(assetType)}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch");
        const rawData = await res.json();

        let data: ETF[] = [];
        try {
          data = z.array(ETFSchema).parse(rawData);
        } catch (e) {
          if (e instanceof z.ZodError) {
            console.warn("API response validation failed:", e.issues);
          } else {
            console.warn("API response validation failed:", e);
          }
          data = [];
        }

        // Filter results on client side
        if (assetType) {
          const valid = data.filter((item) => item.assetType === assetType);
          const other = data.filter((item) => item.assetType !== assetType);

          if (skip === 0) {
            setEtfs(valid);
            setOtherTypeEtfs(other);
            setSuggestions(valid);
          } else {
            setEtfs((prev) => {
              // Deduplicate by ticker to prevent key collisions
              const existingTickers = new Set(prev.map((e) => e.ticker));
              const newItems = valid.filter(
                (e) => !existingTickers.has(e.ticker),
              );
              return [...prev, ...newItems];
            });
          }

          if (data.length === 0) {
            setHasMoreServer(false);
          } else {
            setHasMoreServer(true);
          }
          return valid.length;
        } else {
          if (skip === 0) {
            setEtfs(data);
            setSuggestions(data);
            setOtherTypeEtfs([]);
          } else {
            setEtfs((prev) => {
              const existingTickers = new Set(prev.map((e) => e.ticker));
              const newItems = data.filter(
                (e) => !existingTickers.has(e.ticker),
              );
              return [...prev, ...newItems];
            });
          }

          if (data.length === 0) {
            setHasMoreServer(false);
          } else {
            setHasMoreServer(true);
          }
          return data.length;
        }
      } catch (err) {
        console.error("Failed to load ETF data", err);
        if (skip === 0) {
          setEtfs([]);
          setSuggestions([]);
          setOtherTypeEtfs([]);
        }
        return 0;
      } finally {
        setLoading(false);
      }
    },
    [assetType],
  );

  // Effect for main search/grid
  useEffect(() => {
    // Reset server pagination state on new search
    setHasMoreServer(true);
    fetchEtfs(debouncedSearch, 0);
  }, [debouncedSearch, fetchEtfs]);

  // Reset pagination when search or asset type changes
  useEffect(() => {
    setVisibleCount(24);
  }, [debouncedSearch, assetType]);

  const handleLoadMore = async () => {
    // If we have more local items to show, just increase visible count
    if (visibleCount < etfs.length) {
      setVisibleCount((prev) => prev + 24);
    } else if (hasMoreServer) {
      // If we showed all local, try fetching more from server
      // Use current etfs.length as skip
      const count = await fetchEtfs(debouncedSearch, etfs.length);
      if (count > 0) {
        setVisibleCount((prev) => prev + 24);
      }
    }
  };

  // Effect to handle "No Results Found" drawer (Search returns 0)
  // We only trigger this if search is active (debouncedSearch) and both lists are empty.
  useEffect(() => {
    if (
      !loading &&
      debouncedSearch &&
      etfs.length === 0 &&
      otherTypeEtfs.length === 0
    ) {
      // debouncedSearch changes rarely enough to reopen without loop-guarding on isOpen,
      // which would need isOpen in the dependency array and re-run on every close.
      setMessageDrawer({
        isOpen: true,
        title: "No results",
        message: `No ${assetType === "STOCK" ? "stocks" : "ETFs"} match "${debouncedSearch}".`,
        type: "info",
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

  const handleAdvancedView = useCallback(
    (etf: ETF) => {
      addToRecent(etf.ticker);
      setSelectedETF(etf);

      if (etf.isDeepAnalysisLoaded) return;

      fetch("/api/etfs/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: etf.ticker }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));

            if (res.status === 404 && errorData.deleted) {
              setEtfs((prev) => prev.filter((e) => e.ticker !== etf.ticker));
              setMessageDrawer({
                isOpen: true,
                title: "Ticker Not Found",
                message: `Ticker ${etf.ticker} was not found and has been removed from your list.`,
                type: "error",
              });
              return;
            }

            console.error("Sync failed response:", JSON.stringify(errorData));
            return;
          }

          const rawUpdatedEtf = await res.json();
          let updatedEtf: ETF;
          try {
            updatedEtf = ETFSchema.parse(rawUpdatedEtf);
          } catch (e) {
            if (e instanceof z.ZodError) {
              console.warn("API response validation failed:", e.issues);
            } else {
              console.warn("API response validation failed:", e);
            }
            return;
          }

          setEtfs((prev) =>
            prev.map((e) => (e.ticker === updatedEtf.ticker ? updatedEtf : e)),
          );
        })
        .catch((err) => {
          console.error("Failed to sync ETF details", err);
        });
    },
    [addToRecent],
  ); // addToRecent is stable (useCallback)

  const handleTickerSelect = useCallback(
    (ticker: string) => {
      if (selectedETF?.ticker === ticker) return;

      const existing =
        etfs.find((e) => e.ticker === ticker) ||
        otherTypeEtfs.find((e) => e.ticker === ticker);
      if (existing) {
        handleAdvancedView(existing);
      } else {
        const placeholder: ETF = {
          ticker,
          name: ticker,
          price: 0,
          changePercent: 0,
          assetType: "STOCK",
          history: [],
          metrics: {},
          allocation: { equities: 0, bonds: 0, cash: 0 },
        };
        handleAdvancedView(placeholder);
      }
    },
    [etfs, otherTypeEtfs, selectedETF, handleAdvancedView],
  );

  const renderNoResults = () => {
    if (loading) return null;

    // Case 1: Found items but in the other section
    if (etfs.length === 0 && otherTypeEtfs.length > 0) {
      let otherSection = "ETFs";
      if (assetType === "STOCK") otherSection = "ETFs";
      else if (assetType === "ETF") otherSection = "Stocks";
      // Determine correct other section based on actual returned item type
      const firstOther = otherTypeEtfs[0];
      if (firstOther.assetType === "STOCK") otherSection = "Stocks";
      else if (firstOther.assetType === "ETF") otherSection = "ETFs";

      const sample = otherTypeEtfs[0].ticker;
      // Fixed phrasing: handle singular vs plural
      const othersCount = otherTypeEtfs.length - 1;
      const othersText =
        othersCount > 0
          ? `and ${othersCount} other${othersCount === 1 ? "" : "s"}`
          : "";

      return (
        <div className="col-span-full text-center text-neutral-400 py-12 flex flex-col items-center">
          <Search className="h-12 w-12 text-emerald-400 mb-4" />
          <p className="text-lg text-ink mb-2">
            Found matches in {otherSection}
          </p>
          <p className="text-neutral-400">
            We found &ldquo;{sample}&rdquo;{othersText ? ` ${othersText}` : ""} in the{" "}
            {otherSection} section.
          </p>
          <p className="text-sm text-neutral-400 mt-2">
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
    setMessageDrawer((prev) => ({ ...prev, isOpen: false }));
    // Clear the search so closing returns to the browse list, not an empty grid.
    if (messageDrawer.type === "info" && search) {
      setSearch("");
    }
  };

  // Recent first (relevance), then user sort/filter
  const sortedEtfs = useMemo(() => {
    let base = etfs;
    if (recentTickers.length > 0 && filters.sort === "relevance") {
      base = [...etfs].sort((a, b) => {
        const indexA = recentTickers.indexOf(a.ticker);
        const indexB = recentTickers.indexOf(b.ticker);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
      });
    }
    return applyMarketFilters(base, filters);
  }, [etfs, recentTickers, filters]);

  const displayedEtfs = sortedEtfs.slice(0, visibleCount);
  const resolvedAssetType: "STOCK" | "ETF" =
    assetType === "STOCK" ? "STOCK" : "ETF";

  return (
    <section className="py-12 md:py-24 px-4 max-w-7xl mx-auto min-h-full">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 md:mb-10 gap-6">
          <div className="w-full md:w-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-ink mb-2">
              Market Browser
            </h2>
            <p className="text-sm md:text-base text-neutral-400">
              Browse live quotes and available market data for{" "}
              {resolvedAssetType === "STOCK" ? "stocks" : "ETFs"}. Filter the
              list, then open a card for details.
            </p>
          </div>

          {/* Search Bar with Smart Autocomplete */}
          <div className="relative w-full md:w-96" ref={searchContainerRef}>
            <div className="relative">
              <div
                className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10"
                aria-hidden="true"
              >
                <Search className="h-6 w-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)] transition-all" />
              </div>
              <input
                type="text"
                aria-label="Search tickers"
                placeholder="Search ticker or name..."
                className="block w-full pl-12 pr-3 py-4 border border-hairline rounded-xl bg-surface-card text-ink placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-md transition-all text-lg shadow-lg"
                value={search}
                onChange={(e) => {
                  const value = e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9.\s-&]/g, "");
                  setSearch(value);
                }}
                onFocus={() => {
                  if (search) setShowSuggestions(true);
                }}
              />
            </div>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.ul
                  role="listbox"
                  aria-label="Search suggestions"
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-50 w-full mt-2 bg-canvas border border-hairline rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl"
                >
                  {suggestions.slice(0, 5).map((item) => (
                    <motion.li
                      key={item.ticker}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="cursor-pointer hover:bg-surface-soft transition-colors"
                      onClick={() => handleSuggestionClick(item)}
                    >
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-ink text-sm">
                            {item.ticker}
                          </span>
                          <span className="text-xs text-neutral-400 truncate max-w-[200px]">
                            {item.name}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "text-xs font-medium text-ink",
                          )}
                        >
                          {formatCurrency(item.price, item.currency)}
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Left filters + right grid */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start pb-20">
          <MarketFilters
            assetType={resolvedAssetType}
            value={filters}
            onChange={(next) => {
              setFilters(next);
              setVisibleCount(24);
            }}
            resultCount={loading ? undefined : sortedEtfs.length}
          />

          <div className="flex-1 min-w-0 w-full">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-64 rounded-xl bg-surface-card animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {displayedEtfs.map((etf) => (
                  <ETFCard
                    key={etf.ticker}
                    etf={etf}
                    inPortfolio={isInPortfolio(etf.ticker)}
                    flashState={flashStates[etf.ticker]}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                    onView={handleAdvancedView}
                  />
                ))}
                {renderNoResults()}

                {!loading && sortedEtfs.length === 0 && etfs.length > 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-16 text-center gap-3">
                    <Filter className="w-10 h-10 text-neutral-600" />
                    <p className="text-ink font-medium">No matches</p>
                    <p className="text-sm text-neutral-500 max-w-sm">
                      Nothing fits these filters. Try clearing a filter or
                      resetting on the left.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFilters({ ...DEFAULT_MARKET_FILTERS })}
                      className="mt-2 text-sm text-emerald-400 hover:text-emerald-300 underline"
                    >
                      Reset filters
                    </button>
                  </div>
                )}

                {/* Load More Button */}
                {(displayedEtfs.length < sortedEtfs.length ||
                  (hasMoreServer && filters.sort === "relevance")) &&
                  sortedEtfs.length > 0 && (
                    <div className="col-span-full flex justify-center mt-8">
                      <button
                        onClick={handleLoadMore}
                        className="flex items-center gap-2 px-6 py-3 bg-surface-card hover:bg-surface-soft text-ink rounded-full transition-all border border-hairline hover:border-emerald-500/50"
                      >
                        <ChevronDown className="w-4 h-4" />
                        Load More{" "}
                        {displayedEtfs.length < sortedEtfs.length &&
                          `(${sortedEtfs.length - displayedEtfs.length} more)`}
                      </button>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
      <ETFDetailsDrawer
        etf={selectedETF}
        onClose={() => setSelectedETF(null)}
        onTickerSelect={handleTickerSelect}
      />
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
