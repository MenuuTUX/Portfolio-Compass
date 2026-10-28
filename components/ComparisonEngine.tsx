"use client";

import Image from "next/image";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
  useSyncExternalStore,
} from "react";
import { Search, ChevronDown, ChevronLeft, ChevronRight, Filter, SlidersHorizontal, ListFilter } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { getAssetIconUrl } from "@/lib/etf-providers";
import { ETF, PortfolioItem } from "@/types";
import { ETFSchema } from "@/schemas/assetSchema";
import { z } from "zod";
import { motion, useReducedMotion } from "framer-motion";
import Reveal, { EASE } from "./motion/Reveal";
import HoldingIcon from "./workspace/HoldingIcon";
import Shimmer from "./workspace/Shimmer";
import ETFDetailsDrawer from "./ETFDetailsDrawer";
import MessageDrawer from "./MessageDrawer";
import Sparkline from "./Sparkline";
import AssetWorkspace from "./workspace/AssetWorkspace";
import {
  LEFT_PANE,
  RIGHT_PANE,
  maxLeftPane,
  maxRightPane,
  PaneResizer,
  useResizableWidth,
} from "./workspace/PaneResizer";
import { useAssetChart } from "./workspace/useAssetChart";
import { useAssetDetails } from "./workspace/useAssetDetails";
import MarketFilters, {
  DEFAULT_MARKET_FILTERS,
  MarketFilterState,
  applyMarketFilters,
} from "./MarketFilters";

interface ETFRowProps {
  etf: ETF;
  /** Position in the visible list; the first 14 stagger in on first paint. */
  index: number;
  inPortfolio: boolean;
  selected: boolean;
  flashState: "success" | "error" | null;
  onAdd: (etf: ETF) => void;
  onRemove: (ticker: string) => void;
  onView: (etf: ETF) => void;
}

const GAIN_HEX = "#6dc382";
const LOSS_HEX = "#f87171";

// One dense list row. Memoized to isolate state updates (like flash animations)
const ETFRow = memo(
  ({
    etf,
    index,
    inPortfolio,
    selected,
    flashState,
    onAdd,
    onRemove,
    onView,
  }: ETFRowProps) => {
    const reduceMotion = useReducedMotion();
    const quoteUnavailable = etf.quoteStatus === "unavailable";
    const change = etf.changePercent;
    const iconUrl = getAssetIconUrl(etf.ticker, etf.name, etf.assetType);
    const displayHistory = etf.history ?? [];

    let isGraphPositive = change >= 0;
    if (displayHistory.length > 0) {
      isGraphPositive =
        displayHistory[displayHistory.length - 1].price >= displayHistory[0].price;
    }

    const deltaText = quoteUnavailable
      ? "Unavailable"
      : `${change > 0 ? "+" : change < 0 ? "−" : ""}${Math.abs(change).toFixed(2)}%`;

    return (
      <motion.li
        initial={{ opacity: 0, y: 8 }}
        animate={{
          opacity: 1,
          y: 0,
          x: flashState && !reduceMotion ? [0, -4, 4, -4, 4, 0] : 0,
        }}
        transition={{
          opacity: { duration: 0.3, ease: EASE, delay: index < 14 ? index * 0.03 : 0 },
          y: { duration: 0.3, ease: EASE, delay: index < 14 ? index * 0.03 : 0 },
          x: { duration: 0.4 },
        }}
        className={cn(
          "relative flex items-center gap-1 pr-2 lg:pr-1.5 transition-colors duration-75",
          flashState === "success" && "bg-emerald-400/10",
          flashState === "error" && "bg-rose-400/10",
          !flashState && !selected && "hover:bg-surface-soft/60",
        )}
      >
        {selected && (
          <motion.span
            layoutId="watchlist-active-row"
            aria-hidden="true"
            className="absolute inset-0 bg-surface-soft"
            transition={{ duration: 0.28, ease: EASE }}
          />
        )}
        <button
          type="button"
          onClick={() => onView(etf)}
          aria-pressed={selected}
          className="relative flex flex-1 min-w-0 items-center gap-3 lg:gap-2.5 pl-4 lg:pl-3 py-3 lg:py-0 min-h-14 lg:min-h-0 lg:h-[42px] text-left rounded-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-compass"
        >
          <span className="w-10 h-10 rounded-lg lg:w-7 lg:h-7 lg:rounded-full bg-surface-soft flex items-center justify-center shrink-0 overflow-hidden">
            {iconUrl ? (
              <Image
                src={iconUrl}
                alt={`${etf.ticker} logo`}
                width={28}
                height={28}
                className="w-7 h-7 lg:w-5 lg:h-5 object-contain"
              />
            ) : (
              <span className="text-sm lg:text-xs font-bold text-ink">
                {etf.ticker.slice(0, 1)}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm lg:text-xs font-bold text-ink truncate">
              {etf.ticker}
            </span>
            <span className="block text-xs text-muted truncate" title={etf.name}>
              {etf.name}
            </span>
          </span>
          {displayHistory.length > 0 ? (
            <span className="hidden sm:block lg:hidden shrink-0">
              <Sparkline
                data={displayHistory}
                color={isGraphPositive ? GAIN_HEX : LOSS_HEX}
                name={etf.ticker}
              />
            </span>
          ) : (
            <span className="hidden sm:block lg:hidden shrink-0 text-xs text-muted-soft">
              Chart unavailable
            </span>
          )}
          <span className="text-right shrink-0 min-w-[84px] lg:min-w-0">
            <span className="block text-sm lg:text-xs font-bold text-ink font-mono">
              {quoteUnavailable ? "N/A" : formatCurrency(etf.price, etf.currency)}
            </span>
            <span
              className={cn(
                "block text-xs font-medium font-mono",
                quoteUnavailable || change === 0
                  ? "text-muted"
                  : change > 0
                    ? "text-emerald-400"
                    : "text-rose-400",
              )}
            >
              {deltaText}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => (inPortfolio ? onRemove(etf.ticker) : onAdd(etf))}
          aria-label={
            inPortfolio
              ? `Remove ${etf.ticker} from portfolio`
              : `Add ${etf.ticker} to portfolio`
          }
          title={inPortfolio ? "In portfolio. Click to remove" : "Add to portfolio"}
          className={cn(
            "relative w-11 h-11 lg:w-7 lg:h-7 shrink-0 rounded-xl lg:rounded-md flex items-center justify-center transition-colors duration-75 hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-compass",
            inPortfolio ? "text-emerald-400" : "text-body-strong",
          )}
        >
          <HoldingIcon inPortfolio={inPortfolio} className="w-5 h-5 lg:w-4 lg:h-4" />
        </button>
      </motion.li>
    );
  },
);

ETFRow.displayName = "ETFRow";

interface ComparisonEngineProps {
  onAddToPortfolio: (etf: ETF) => Promise<void>;
  onRemoveFromPortfolio: (ticker: string) => void;
  portfolio: PortfolioItem[];
  assetType?: string;
}

// True at the lg breakpoint (1024px) and up; false during SSR.
const LG_QUERY = "(min-width: 1024px)";
function subscribeLg(callback: () => void) {
  const mq = window.matchMedia(LG_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}
function useIsLg() {
  return useSyncExternalStore(
    subscribeLg,
    () => window.matchMedia(LG_QUERY).matches,
    () => false,
  );
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
  const isLg = useIsLg();
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [otherTypeEtfs, setOtherTypeEtfs] = useState<ETF[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ETF[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedETF, setSelectedETF] = useState<ETF | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [listCollapsed, setListCollapsed] = useState(false);
  const left = useResizableWidth("left", LEFT_PANE.initial, LEFT_PANE.min, maxLeftPane);
  const right = useResizableWidth("right", RIGHT_PANE.initial, RIGHT_PANE.min, maxRightPane);
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

  // lg+ workspace: hydrate the selected asset and own its chart once, then
  // share both with the center chart and the right details panel
  const selectedDisplay = useAssetDetails(isLg ? selectedETF : null);
  const chart = useAssetChart(
    isLg ? (selectedDisplay?.ticker ?? null) : null,
    selectedDisplay?.changePercent ?? 0,
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
    async (query: string, skip = 0, signal?: AbortSignal) => {
      if (skip === 0) setLoading(true);
      const buildUrl = (includeDetails: boolean) => {
        let url = `/api/market/search?query=${encodeURIComponent(query)}&skip=${skip}&limit=24`;
        if (assetType) url += `&type=${encodeURIComponent(assetType)}`;
        if (!includeDetails) url += "&history=false&profiles=false";
        return url;
      };

      const parseAssets = async (response: Response): Promise<ETF[]> => {
        const rawData = await response.json();
        try {
          return z.array(ETFSchema).parse(rawData);
        } catch (error) {
          if (error instanceof z.ZodError) {
            console.warn("API response validation failed:", error.issues);
          } else {
            console.warn("API response validation failed:", error);
          }
          return [];
        }
      };

      const applyResults = (data: ETF[], pageSkip: number) => {
        const items = assetType
          ? data.filter((item) => item.assetType === assetType)
          : data;

        if (pageSkip === 0) {
          setEtfs(items);
          setSuggestions(items);
          setOtherTypeEtfs(
            assetType ? data.filter((item) => item.assetType !== assetType) : [],
          );
        } else {
          setEtfs((previous) => {
            const existing = new Set(previous.map((item) => item.ticker));
            return [...previous, ...items.filter((item) => !existing.has(item.ticker))];
          });
        }
        setHasMoreServer(data.length > 0);
        return items.length;
      };

      try {
        const res = await fetch(buildUrl(skip !== 0), { signal });
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await parseAssets(res);
        const count = applyResults(data, skip);

        if (skip === 0) {
          const detailsUrl = `/api/etfs/search?tickers=${encodeURIComponent(data.map((item) => item.ticker).join(","))}&includeHistory=true&profiles=true`;
          void fetch(detailsUrl, { signal })
            .then((response) => response.ok ? parseAssets(response) : [])
            .then((details) => {
              if (signal?.aborted || details.length === 0) return;
              const detailByTicker = new Map(details.map((item) => [item.ticker, item]));
              const merge = (item: ETF) => {
                const detail = detailByTicker.get(item.ticker);
                return detail
                  ? { ...item, ...detail, history: detail.history.length ? detail.history : item.history }
                  : item;
              };
              setEtfs((items) => items.map(merge));
              setSuggestions((items) => items.map(merge));
              setOtherTypeEtfs((items) => items.map(merge));
            })
            .catch((error) => {
              if (!signal?.aborted) console.warn("Market details failed to load:", error);
            });
        }
        return count;
      } catch (err) {
        if (signal?.aborted) return 0;
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
    const controller = new AbortController();
    fetchEtfs(debouncedSearch, 0, controller.signal);
    return () => controller.abort();
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
        <div className="text-center text-muted py-12 px-4 flex flex-col items-center">
          <Search className="h-6 w-6 text-muted-soft mb-3" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink mb-1">
            Found matches in {otherSection}
          </p>
          <p className="text-xs text-muted">
            We found &ldquo;{sample}&rdquo;{othersText ? ` ${othersText}` : ""} in the{" "}
            {otherSection} section.
          </p>
          <p className="text-xs text-muted mt-1">
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

  // Never leave the lg+ workspace empty: select the first result once loaded
  const firstResult = displayedEtfs[0];
  useEffect(() => {
    if (isLg && !loading && !selectedETF && firstResult) {
      setSelectedETF(firstResult);
    }
  }, [isLg, loading, selectedETF, firstResult]);
  const resolvedAssetType: "STOCK" | "ETF" =
    assetType === "STOCK" ? "STOCK" : "ETF";

  const resultsList = loading ? (
    <ul className="divide-y divide-hairline" aria-busy="true" aria-label="Loading results">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3 min-h-14 lg:px-3 lg:py-0 lg:min-h-0 lg:h-[42px]">
          <Shimmer className="w-10 h-10 lg:w-7 lg:h-7 rounded-lg lg:rounded-full" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-3 w-16" />
            <Shimmer className="h-3 w-32" />
          </div>
          <Shimmer className="h-8 w-20" />
        </li>
      ))}
    </ul>
  ) : (
    <>
      <ul className="divide-y divide-hairline" aria-label={resolvedAssetType === "STOCK" ? "Stocks" : "ETFs"}>
        {displayedEtfs.map((etf, index) => (
          <ETFRow
            key={etf.ticker}
            index={index}
            etf={etf}
            inPortfolio={isInPortfolio(etf.ticker)}
            selected={selectedETF?.ticker === etf.ticker}
            flashState={flashStates[etf.ticker]}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onView={handleAdvancedView}
          />
        ))}
      </ul>
      {renderNoResults()}

      {!loading && sortedEtfs.length === 0 && etfs.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-2">
          <Filter className="w-6 h-6 text-muted-soft" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">No matches</p>
          <p className="text-xs text-muted max-w-sm">
            Nothing fits these filters. Try clearing a filter or resetting.
          </p>
          <button
            type="button"
            onClick={() => setFilters({ ...DEFAULT_MARKET_FILTERS })}
            className="mt-2 min-h-11 px-4 text-sm font-medium text-compass hover:underline"
          >
            Reset filters
          </button>
        </div>
      )}

      {(displayedEtfs.length < sortedEtfs.length ||
        (hasMoreServer && filters.sort === "relevance")) &&
        sortedEtfs.length > 0 && (
          <div className="flex justify-center p-4">
            <button
              type="button"
              onClick={handleLoadMore}
              className="inline-flex items-center gap-2 px-5 min-h-11 rounded-full bg-surface-soft hover:bg-hairline-strong text-sm font-semibold text-ink transition-colors duration-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass"
            >
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
              Load more{" "}
              {displayedEtfs.length < sortedEtfs.length &&
                `(${sortedEtfs.length - displayedEtfs.length} more)`}
            </button>
          </div>
        )}
    </>
  );

  const panel = "ws-panel bg-surface-card rounded-lg ring-1 ring-hairline";
  const collapsedList = isLg && listCollapsed;
  const sectionTitle = resolvedAssetType === "STOCK" ? "Stocks" : "ETFs";
  const filtersId = "market-filters-panel";
  const activeFilters = filters.sort !== DEFAULT_MARKET_FILTERS.sort ||
    filters.performance !== DEFAULT_MARKET_FILTERS.performance ||
    filters.yieldFilter !== DEFAULT_MARKET_FILTERS.yieldFilter ||
    filters.size !== DEFAULT_MARKET_FILTERS.size ||
    filters.pe !== DEFAULT_MARKET_FILTERS.pe ||
    filters.mer !== DEFAULT_MARKET_FILTERS.mer;

  return (
    <section
      className="flex flex-col gap-2 px-4 py-4 lg:p-0 lg:h-full lg:min-h-0"
      aria-label={`${sectionTitle} market browser`}
    >
      <span className="sr-only" aria-live="polite">
        {loading
          ? "Loading"
          : `${sortedEtfs.length} ${sortedEtfs.length === 1 ? "result" : "results"}`}
      </span>
      <div className="flex flex-col gap-2 lg:gap-0 lg:flex-row lg:flex-1 lg:min-h-0 lg:h-full">
        {/* Left: watchlist-style list (collapses to a 48px strip at lg+) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{
            opacity: 1,
            y: 0,
            ...(isLg ? { width: collapsedList ? "3rem" : `${left.width}px` } : {}),
          }}
          transition={{
            opacity: { duration: 0.5, ease: EASE },
            y: { duration: 0.5, ease: EASE },
            width: { duration: left.dragging ? 0 : 0.28, ease: EASE },
          }}
          className={cn(
            panel,
            "relative flex flex-col lg:shrink-0 lg:min-h-0 lg:h-full lg:overflow-hidden",
          )}
        >
          {collapsedList && (
            <div className="absolute inset-0 z-10 flex flex-col items-center gap-2 pt-2 bg-surface-card">
              <button
                type="button"
                onClick={() => setListCollapsed(false)}
                aria-label={`Expand ${sectionTitle} list`}
                title={`Expand ${sectionTitle} list`}
                className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-surface-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-compass"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <ListFilter className="w-4 h-4 text-muted-soft" aria-hidden="true" />
            </div>
          )}
          <div
            inert={collapsedList}
            className="flex flex-col flex-1 min-h-0 min-w-0"
          >
          <div className="flex items-center justify-between gap-3 pl-4 pr-2 pt-2 shrink-0">
            <h2 className="flex items-baseline gap-2 text-sm font-bold text-ink">
              {sectionTitle}
              {!loading && (
                <span className="text-xs font-normal text-muted">
                  {sortedEtfs.length}
                </span>
              )}
            </h2>
            <div className="flex items-center">
            {isLg && (
              <button
                type="button"
                onClick={() => setListCollapsed(true)}
                aria-label={`Collapse ${sectionTitle} list`}
                title={`Collapse ${sectionTitle} list`}
                className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-surface-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-compass"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-controls={filtersId}
              aria-label="Sort and filter"
              title="Sort and filter"
              className={cn(
                "relative w-11 h-11 lg:w-8 lg:h-8 rounded-md flex items-center justify-center transition-colors duration-75 hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-compass",
                filtersOpen ? "bg-surface-soft text-ink" : "text-muted hover:text-ink",
              )}
            >
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              {activeFilters && (
                <span
                  className="absolute top-2 right-2 lg:top-1.5 lg:right-1.5 w-1.5 h-1.5 rounded-full bg-compass"
                  aria-hidden="true"
                />
              )}
            </button>
            </div>
          </div>

          {filtersOpen && (
            <div
              id={filtersId}
              className="border-y border-hairline max-h-[55%] overflow-y-auto custom-scrollbar shrink-0"
            >
              <MarketFilters
                embedded
                assetType={resolvedAssetType}
                value={filters}
                onChange={(next) => {
                  setFilters(next);
                  setVisibleCount(24);
                }}
                resultCount={loading ? undefined : sortedEtfs.length}
              />
            </div>
          )}

          <div className="relative px-3 pb-2 shrink-0" ref={searchContainerRef}>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label="Search tickers"
                placeholder="Search ticker or name"
                className="block w-full h-11 lg:h-8 pl-9 pr-3 rounded-lg bg-surface-soft text-sm lg:text-xs text-ink placeholder:text-muted ring-1 ring-hairline focus-visible:outline-2 focus-visible:outline-compass"
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

            {showSuggestions && suggestions.length > 0 && (
              <ul
                role="listbox"
                aria-label="Search suggestions"
                className="absolute left-3 right-3 top-full -mt-1 z-30 bg-surface-card ring-1 ring-hairline-strong rounded-lg shadow-2xl overflow-hidden"
              >
                {suggestions.slice(0, 5).map((item) => (
                  <li
                    key={item.ticker}
                    role="option"
                    aria-selected={false}
                    className="cursor-pointer hover:bg-surface-soft transition-colors duration-75"
                    onClick={() => handleSuggestionClick(item)}
                  >
                    <div className="flex items-center justify-between gap-3 px-3 py-2 min-h-11">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-ink text-xs">{item.ticker}</span>
                        <span className="text-xs text-muted truncate">{item.name}</span>
                      </div>
                      <div className="text-xs font-bold text-ink font-mono shrink-0">
                        {formatCurrency(item.price, item.currency)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex-1 min-h-0 lg:overflow-y-auto custom-scrollbar">
            {resultsList}
          </div>
          </div>
        </motion.div>

        {isLg && (
          collapsedList ? (
            <div className="w-2 shrink-0" aria-hidden="true" />
          ) : (
            <PaneResizer
              label="Resize markets list"
              width={left.width}
              direction={1}
              onResize={left.setWidth}
              onCommit={left.persist}
              onDraggingChange={left.setDragging}
              onReset={left.reset}
            />
          )
        )}

        {/* Center: instrument header, chart, bottom drawer (lg+) */}
        {isLg && (
          <Reveal
            onMount
            y={12}
            duration={0.5}
            delay={0.06}
            className={cn(panel, "flex flex-col flex-1 min-w-0 min-h-0 h-full overflow-hidden")}
          >
            <AssetWorkspace
              etf={selectedDisplay}
              chart={chart}
              portfolio={portfolio}
              inPortfolio={
                selectedDisplay ? isInPortfolio(selectedDisplay.ticker) : false
              }
              onAdd={handleAdd}
              onRemove={handleRemove}
              detailsOpen={detailsOpen}
              onToggleDetails={() => setDetailsOpen((o) => !o)}
            />
          </Reveal>
        )}

        {isLg && detailsOpen && (
          <PaneResizer
            label="Resize details panel"
            width={right.width}
            direction={-1}
            onResize={right.setWidth}
            onCommit={right.persist}
            onDraggingChange={right.setDragging}
            onReset={right.reset}
          />
        )}

        {/* Right: details (lg+ docked; below lg opens as bottom sheet) */}
        {isLg && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{
              opacity: detailsOpen ? 1 : 0,
              y: 0,
              width: detailsOpen ? right.width : 0,
            }}
            transition={{
              opacity: { duration: detailsOpen ? 0.5 : 0.2, ease: EASE, delay: detailsOpen ? 0.12 : 0 },
              y: { duration: 0.5, ease: EASE, delay: 0.12 },
              width: { duration: right.dragging ? 0 : 0.28, ease: EASE },
            }}
            className={cn(panel, "shrink-0 min-h-0 h-full overflow-hidden")}
          >
            <div inert={!detailsOpen} className="h-full w-full min-w-0">
              <ETFDetailsDrawer
                docked
                etf={selectedDisplay}
                chart={chart}
                onClose={() => setDetailsOpen(false)}
                onTickerSelect={handleTickerSelect}
              />
            </div>
          </motion.div>
        )}
        {!isLg && (
          <ETFDetailsDrawer
            etf={selectedETF}
            onClose={() => setSelectedETF(null)}
            onTickerSelect={handleTickerSelect}
          />
        )}
      </div>

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
