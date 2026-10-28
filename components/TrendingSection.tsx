"use client";

import Image from "next/image";
import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Check, ChevronRight } from "lucide-react";
import { ETF, PortfolioItem } from "@/types";
import { cn, formatCurrency } from "@/lib/utils";
import { getAssetIconUrl } from "@/lib/etf-providers";
import Sparkline from "./Sparkline";
import { HelpTip } from "./ui/HelpTip";
import { describeYieldProvenance, getSourcedYield, isUnverifiedProviderYield } from "@/lib/yield-provenance";
import { quoteSessionLabel } from "@/lib/quote-session";
import { EASE } from "./motion/Reveal";

interface TrendingSectionProps {
  title: string;
  items: ETF[];
  Icon: React.ElementType;
  theme?: "emerald" | "rose" | "purple" | "orange" | "amber";
  onAddToPortfolio: (etf: ETF) => Promise<void>;
  portfolio?: PortfolioItem[];
  onRemoveFromPortfolio?: (ticker: string) => void;
  onSelectItem: (etf: ETF) => void;
  communityLookup?: (
    ticker: string,
    assetType?: string,
  ) => { name: string; url: string }[];
  /** "watchlist" renders compact 42px rows for the Advanced workspace left panel. */
  variant?: "card" | "watchlist";
  /** Ticker highlighted with the sliding indicator (watchlist variant). */
  selectedTicker?: string | null;
  /** Rows rendered before this group, so the entrance stagger runs across groups. */
  startIndex?: number;
}

/** Shared by every watchlist row so the indicator slides between groups. */
const SELECTED_INDICATOR_ID = "markets-watchlist-selected";
const STAGGER_ROWS = 14;

export default function TrendingSection({
  title,
  items,
  Icon,
  onAddToPortfolio,
  portfolio = [],
  onRemoveFromPortfolio,
  onSelectItem,
  variant = "card",
  selectedTicker = null,
  startIndex = 0,
}: TrendingSectionProps) {
  const [visibleCount, setVisibleCount] = useState(8);
  const [flashStates, setFlashStates] = useState<
    Record<string, "success" | "error" | null>
  >({});

  const triggerFlash = useCallback(
    (ticker: string, type: "success" | "error") => {
      setFlashStates((prev) => ({ ...prev, [ticker]: type }));
      setTimeout(() => {
        setFlashStates((prev) => ({ ...prev, [ticker]: null }));
      }, 500);
    },
    [],
  );

  const handleAdd = async (etf: ETF) => {
    try {
      await onAddToPortfolio(etf);
      triggerFlash(etf.ticker, "success");
    } catch (error) {
      console.error("Failed to add to portfolio", error);
      triggerFlash(etf.ticker, "error");
    }
  };

  const handleRemove = (ticker: string) => {
    if (onRemoveFromPortfolio) {
      onRemoveFromPortfolio(ticker);
      triggerFlash(ticker, "error");
    }
  };

  // Open the drawer immediately. It streams its own chart and metrics from
  // the fast market endpoints and hydrates deep data in the background.
  const handleView = (etf: ETF) => {
    onSelectItem(etf);
  };

  const isItemInPortfolio = (ticker: string) => {
    return portfolio.some(
      (item) => item.ticker.toUpperCase() === ticker.toUpperCase(),
    );
  };

  if (variant === "watchlist") {
    return (
      <section aria-label={title} className="pb-2">
        <h2 className="px-3 pt-3 pb-1 text-xs font-bold text-ink">{title}</h2>
        {items.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted">Loading {title}...</p>
        ) : (
          <ul>
            {items.map((etf, i) => {
              const inPortfolio = isItemInPortfolio(etf.ticker);
              const flashState = flashStates[etf.ticker];
              const iconUrl = getAssetIconUrl(etf.ticker, etf.name, etf.assetType);
              const unavailable = etf.quoteStatus === "unavailable";
              const selected = selectedTicker === etf.ticker;
              const rowIndex = startIndex + i;
              const sign = etf.changePercent > 0 ? "+" : etf.changePercent < 0 ? "-" : "";
              return (
                <motion.li
                  key={etf.ticker}
                  initial={rowIndex < STAGGER_ROWS ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: rowIndex < STAGGER_ROWS ? rowIndex * 0.03 : 0, ease: EASE }}
                  className={cn(
                    "relative mx-1 flex items-center rounded-md h-[42px] transition-colors duration-75 hover:bg-white/5",
                    flashState === "success" && "bg-emerald-500/10",
                    flashState === "error" && "bg-rose-500/10",
                  )}
                >
                  {selected && (
                    <motion.span
                      layoutId={SELECTED_INDICATOR_ID}
                      aria-hidden="true"
                      className="absolute inset-0 rounded-md bg-white/10"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => handleView(etf)}
                    aria-label={`View details for ${etf.ticker}`}
                    aria-current={selected ? "true" : undefined}
                    className="relative flex flex-1 min-w-0 items-center gap-2 pl-2 pr-1 h-full text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-compass"
                  >
                    <span className="w-7 h-7 rounded-full bg-surface-soft flex items-center justify-center shrink-0 overflow-hidden">
                      {iconUrl ? (
                        <Image src={iconUrl} alt={`${etf.ticker} logo`} width={20} height={20} className="w-5 h-5 object-contain" />
                      ) : (
                        <span className="text-[10px] font-bold text-muted">{etf.ticker.slice(0, 2)}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-ink leading-4">{etf.ticker}</span>
                      <span className="block truncate text-xs text-muted leading-4">{etf.name}</span>
                    </span>
                    <span className="text-right shrink-0 tabular-nums">
                      <span className="block text-xs font-bold text-ink leading-4">
                        {unavailable ? "N/A" : formatCurrency(etf.price, etf.currency)}
                      </span>
                      <span
                        className={cn(
                          "block text-xs font-medium leading-4",
                          unavailable ? "text-muted" : etf.changePercent >= 0 ? "text-emerald-400" : "text-rose-400",
                        )}
                      >
                        {unavailable ? "N/A" : `${sign}${Math.abs(etf.changePercent).toFixed(2)}%`}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => (inPortfolio ? handleRemove(etf.ticker) : handleAdd(etf))}
                    aria-label={inPortfolio ? `Remove ${etf.ticker} from portfolio` : `Add ${etf.ticker} to portfolio`}
                    title={inPortfolio ? "Remove from Portfolio" : "Add to Portfolio"}
                    className={cn(
                      "relative mr-1 w-7 h-7 pointer-coarse:w-11 pointer-coarse:h-11 shrink-0 inline-flex items-center justify-center rounded-full transition-colors duration-75 hover:bg-hairline-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass",
                      inPortfolio ? "text-emerald-400" : "text-muted hover:text-ink",
                    )}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={inPortfolio ? "check" : "plus"}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="inline-flex"
                      >
                        {inPortfolio ? (
                          <Check className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Plus className="w-4 h-4" aria-hidden="true" />
                        )}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  const ownedCount = items.filter((item) =>
    portfolio.some((p) => p.ticker === item.ticker),
  ).length;

  return (
    <section className="mb-8" aria-label={title}>
      <div className="flex items-baseline justify-between mb-3 px-1">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <span className="text-xs text-muted">
          {items.length > 0 && `${visibleItems.length} of ${items.length}`}
          {ownedCount > 0 && ` · ${ownedCount} owned`}
        </span>
      </div>

      {items.length === 0 && (
        <div className="bg-surface-card ring-1 ring-hairline rounded-2xl p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-soft flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-muted" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Loading {title}</h3>
            <p className="text-xs text-muted">
              Fetching the latest data. This may take a moment if the market data is being synced.
            </p>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <ul className="bg-surface-card ring-1 ring-hairline rounded-2xl divide-y divide-hairline overflow-hidden">
          {visibleItems.map((etf) => {
            const inPortfolio = isItemInPortfolio(etf.ticker);
            const flashState = flashStates[etf.ticker];
            const yieldValue = getSourcedYield(etf.metrics, etf.dividendYield);
            const yieldKnown = yieldValue != null;
            const yieldUnverified = isUnverifiedProviderYield(etf.metrics?.yieldSource);
            const quoteTime = etf.quoteAsOf
              ? new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(etf.quoteAsOf))
              : null;
            const quoteUnavailable = etf.quoteStatus === "unavailable";
            const quoteLabel = quoteSessionLabel(etf.quoteSession);
            const iconUrl = getAssetIconUrl(etf.ticker, etf.name, etf.assetType);

            let isGraphPositive = etf.changePercent >= 0;
            if (etf.history && etf.history.length > 0) {
              const firstPrice = etf.history[0].price;
              const lastPrice = etf.history[etf.history.length - 1].price;
              isGraphPositive = lastPrice >= firstPrice;
            }

            const sign = etf.changePercent > 0 ? "+" : etf.changePercent < 0 ? "−" : "";

            return (
              <li
                key={etf.ticker}
                className={cn(
                  "flex items-center transition-colors duration-75 hover:bg-surface-soft/60",
                  flashState === "success" && "bg-emerald-500/10",
                  flashState === "error" && "bg-rose-500/10",
                )}
              >
                <button
                  type="button"
                  onClick={() => handleView(etf)}
                  aria-label={`View details for ${etf.ticker}`}
                  className="flex flex-1 min-w-0 items-center gap-3 px-4 py-3 min-h-[60px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-compass"
                >
                  <div className="w-10 h-10 rounded-xl bg-surface-soft flex items-center justify-center shrink-0 overflow-hidden">
                    {iconUrl ? (
                      <Image src={iconUrl} alt={`${etf.ticker} logo`} width={28} height={28} className="w-7 h-7 object-contain" />
                    ) : (
                      <span className="text-xs font-semibold text-muted">{etf.ticker.slice(0, 3)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink">{etf.ticker}</span>
                      {inPortfolio && (
                        <span className="inline-flex items-center gap-1 bg-surface-soft text-body-strong text-xs font-medium px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" aria-hidden="true" />
                          Owned
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted line-clamp-1">{etf.name}</p>
                  </div>
                  {etf.history && etf.history.length > 0 && (
                    <div className="hidden sm:block shrink-0">
                      <Sparkline
                        data={etf.history}
                        color={isGraphPositive ? "#6dc382" : "#ef7a72"}
                        name={etf.ticker}
                      />
                    </div>
                  )}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-ink tabular-nums">
                      {quoteUnavailable ? "Unavailable" : formatCurrency(etf.price, etf.currency)}
                    </div>
                    <div
                      className={cn(
                        "text-xs font-medium tabular-nums",
                        quoteUnavailable
                          ? "text-muted"
                          : etf.changePercent >= 0
                          ? "text-emerald-400"
                          : "text-rose-400",
                      )}
                    >
                      {quoteUnavailable ? "Change unavailable" : `${sign}${Math.abs(etf.changePercent).toFixed(2)}%`}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-soft shrink-0 hidden sm:block" aria-hidden="true" />
                </button>

                <div
                  className="hidden xl:flex flex-col items-end text-right text-xs text-muted w-36 shrink-0 pr-2"
                  title={quoteUnavailable ? "Quote unavailable" : quoteTime ? `${quoteLabel ? `${quoteLabel} · ` : "Quote as of "}${quoteTime}` : "Quote time unavailable"}
                >
                  <span
                    title={describeYieldProvenance(etf.metrics?.yieldSource, etf.metrics?.yieldRetrievedAt, etf.metrics?.yieldSourceField, etf.metrics?.yieldInputUnit, etf.metrics?.yieldNormalization, etf.metrics?.yieldMeasurementDate)}
                    className={cn("inline-flex items-center gap-1", yieldUnverified && "text-muted-soft")}
                  >
                    {!yieldKnown ? "N/A" : `${yieldValue!.toFixed(2)}%`}{" "}
                    <HelpTip term={yieldUnverified ? "Unverified Yahoo yield unavailable" : "Dividend yield"} showIcon={false} className="text-muted">
                      yield
                    </HelpTip>
                  </span>
                  {yieldUnverified && (
                    <span className="text-xs text-muted-soft">Unverified yield unavailable</span>
                  )}
                </div>

                <div className="pr-3 shrink-0">
                  {inPortfolio ? (
                    <button
                      type="button"
                      onClick={() => handleRemove(etf.ticker)}
                      aria-label={`Remove ${etf.ticker} from portfolio`}
                      title="Remove from Portfolio"
                      className="w-11 h-11 md:w-9 md:h-9 inline-flex items-center justify-center rounded-full bg-surface-soft text-body-strong hover:bg-hairline-strong transition-colors duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAdd(etf)}
                      aria-label={`Add ${etf.ticker} to portfolio`}
                      title="Add to Portfolio"
                      className="w-11 h-11 md:w-9 md:h-9 inline-flex items-center justify-center rounded-full bg-surface-soft text-body-strong hover:bg-hairline-strong transition-colors duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + 8)}
            className="px-4 h-11 md:h-9 bg-surface-soft hover:bg-hairline-strong rounded-full text-sm font-medium text-ink transition-colors duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass"
          >
            Show more
          </button>
        </div>
      )}
    </section>
  );
}
