"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  Tag,
  Zap,
  Sprout,
  Trash2,
  Check,
  Pickaxe,
  ChevronDown,
  MessageCircle,
} from "lucide-react";
import { ETF, PortfolioItem } from "@/types";
import { cn, formatCurrency } from "@/lib/utils";
import { getAssetIconUrl } from "@/lib/etf-providers";
import Sparkline from "./Sparkline";

interface TrendingSectionProps {
  title: string;
  items: ETF[];
  Icon: React.ElementType;
  theme: "emerald" | "rose" | "purple" | "orange" | "amber";
  onAddToPortfolio: (etf: ETF) => Promise<void>;
  portfolio?: PortfolioItem[];
  onRemoveFromPortfolio?: (ticker: string) => void;
  onSelectItem: (etf: ETF) => void;
  communityLookup?: (ticker: string) => { name: string; url: string }[];
}

export default function TrendingSection({
  title,
  items,
  Icon,
  theme,
  onAddToPortfolio,
  portfolio = [],
  onRemoveFromPortfolio,
  onSelectItem,
  communityLookup,
}: TrendingSectionProps) {
  const [visibleCount, setVisibleCount] = useState(8);
  const [flashStates, setFlashStates] = useState<
    Record<string, "success" | "error" | null>
  >({});
  const [syncingTicker, setSyncingTicker] = useState<string | null>(null);

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

  const handleView = async (etf: ETF) => {
    if (etf.isDeepAnalysisLoaded) {
      onSelectItem(etf);
      return;
    }

    setSyncingTicker(etf.ticker);
    try {
      const res = await fetch("/api/etfs/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: etf.ticker }),
      });

      if (!res.ok) {
        // If sync fails, we still try to show what we have, or show error
        // For now, let's just proceed with what we have if sync fails,
        // or just log it. The Drawer might fetch its own fresh data too.
        console.error("Sync failed:", res.statusText);
      } else {
        const rawUpdatedEtf = await res.json();
        // We don't update the list here because it's managed by parent/React Query
        // But we pass the potentially updated data to onSelectItem if we could merge it.
        // However, onSelectItem expects an ETF object.
        // If we want to show fresh data, we should ideally update the state in TrendingTab.
        // But simply opening the drawer triggers fetching fresh data inside the drawer too.
        // So the sync here ensures the backend is up to date.
      }
    } catch (e) {
      console.error("Sync error", e);
    } finally {
      setSyncingTicker(null);
      onSelectItem(etf);
    }
  };

  const isItemInPortfolio = (ticker: string) => {
    return portfolio.some((item) => item.ticker === ticker);
  };

  const getThemeStyles = (t: typeof theme) => {
    switch (t) {
      case "rose":
        return {
          bg: "bg-rose-500/20",
          text: "text-rose-400",
          border: "hover:border-rose-500/30",
          shadow: "hover:shadow-rose-500/20",
          tagBg: "bg-rose-500",
          tagText: "SALE",
          tagIcon: Tag,
        };
      case "purple":
        return {
          bg: "bg-purple-500/20",
          text: "text-purple-400",
          border: "hover:border-purple-500/30",
          shadow: "hover:shadow-purple-500/20",
          tagBg: "bg-purple-500",
          tagText: "ELITE",
          tagIcon: Zap,
        };
      case "orange":
        return {
          tagBg: "bg-[#FF5700]",
          tagText: "REDDIT",
          tagIcon: Sprout,
        };
      case "amber":
        return {
          bg: "bg-amber-500/20",
          text: "text-amber-500",
          border: "hover:border-amber-500/50",
          shadow: "hover:shadow-amber-500/20",
          tagBg: "bg-amber-500",
          tagText: "RESOURCE",
          tagIcon: Pickaxe,
        };
      default:
        return {
          bg: "bg-amber-500/10",
          text: "text-amber-500",
          border: "hover:border-amber-500/50",
          shadow: "hover:shadow-amber-500/10",
          tagBg: "bg-amber-500",
          tagText: "HOT",
          tagIcon: TrendingUp,
        };
    }
  };

  const styles = getThemeStyles(theme);
  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 8);
  };

  // Calculate how many items are owned in this section
  const ownedCount = items.filter((item) =>
    portfolio.some((p) => p.ticker === item.ticker),
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-12"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            className={cn("p-3 rounded-xl", styles.bg)}
          >
            <Icon className={cn("w-6 h-6", styles.text)} />
          </motion.div>
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              {title}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-neutral-400 text-sm font-medium">
                {visibleItems.length} of {items.length} assets
              </span>
              {ownedCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3" />
                  {ownedCount} owned
                </span>
              )}
            </div>
          </div>
        </div>
        {items.length > 8 && (
          <div className="hidden md:flex items-center gap-2 text-sm text-neutral-400">
            <span className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
              {Math.min(visibleItems.length, items.length)}/{items.length}
            </span>
          </div>
        )}
      </div>

      {/* Empty State */}
      {items.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white/5 border border-white/10 border-dashed rounded-2xl p-8 text-center"
        >
          <div className={cn("w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4", styles.bg)}>
            <Icon className={cn("w-8 h-8", styles.text)} />
          </div>
          <h3 className="text-white font-medium mb-2">Loading {title}...</h3>
          <p className="text-neutral-400 text-sm max-w-md mx-auto">
            Fetching the latest data. This may take a moment if the market data is being synced.
          </p>
          <div className="flex justify-center gap-1 mt-4">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className={cn("w-2 h-2 rounded-full", styles.tagBg)}
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {visibleItems.map((etf) => {
          const inPortfolio = isItemInPortfolio(etf.ticker);
          const flashState = flashStates[etf.ticker];
          const communityLinks = communityLookup
            ? communityLookup(etf.ticker)
            : [];

          // Determine graph color based on history trend if available
          let isGraphPositive = etf.changePercent >= 0;
          if (etf.history && etf.history.length > 0) {
            const firstPrice = etf.history[0].price;
            const lastPrice = etf.history[etf.history.length - 1].price;
            isGraphPositive = lastPrice >= firstPrice;
          }

          return (
            <motion.div
              key={etf.ticker}
              initial={{ opacity: 0, y: 20 }}
              animate={
                flashState
                  ? { x: [0, -5, 5, -5, 5, 0], opacity: 1, y: 0 }
                  : { opacity: 1, y: 0 }
              }
              transition={{ duration: 0.4 }}
              className={cn(
                "group relative bg-neutral-900 border-2 border-neutral-800 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1",
                styles.border,
                styles.shadow,
                inPortfolio &&
                  "shadow-[0_0_15px_-2px_rgba(245,158,11,0.3)] border-amber-500/50",
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
                      flashState === "success"
                        ? "bg-amber-500/20"
                        : "bg-red-500/20",
                    )}
                  />
                )}
              </AnimatePresence>

              <div
                className={cn(
                  "absolute top-3 right-3 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg z-10",
                  styles.tagBg,
                )}
              >
                <styles.tagIcon className="w-3 h-3" />
                {styles.tagText}
              </div>

              {/* Amber Blur Overlay for Owned Items */}
              {inPortfolio && (
                <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />
              )}

              <div className="p-5">
                {/* Portfolio Indicator */}
                {inPortfolio && (
                  <div className="inline-flex items-center gap-1 bg-amber-500/20 backdrop-blur-md border border-amber-500/30 text-amber-500 text-xs font-bold px-2 py-1 rounded-sm mb-3 shadow-sm font-mono tracking-wide">
                    <Check className="w-3 h-3" />
                    ACQUIRED
                  </div>
                )}

                <div className="flex items-start gap-3 mb-4">
                  {getAssetIconUrl(etf.ticker, etf.name, etf.assetType) && (
                    <div className="w-10 h-10 flex items-center justify-center shrink-0">
                      <img
                        src={
                          getAssetIconUrl(etf.ticker, etf.name, etf.assetType)!
                        }
                        alt={`${etf.ticker} logo`}
                        className="w-full h-full object-contain"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.parentElement!.style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-white mb-1">
                      {etf.ticker}
                    </h3>
                    <p className="text-xs text-neutral-400 line-clamp-1">
                      {etf.name}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-end mb-4">
                  <div>
                    <span className="block text-2xl font-bold text-white mb-1 font-mono">
                      {formatCurrency(etf.price)}
                    </span>
                    <span
                      className={cn(
                        "flex items-center text-sm font-medium font-mono",
                        etf.changePercent >= 0
                          ? "text-lime-400"
                          : "text-red-500",
                      )}
                    >
                      {etf.changePercent >= 0 ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      {Math.abs(etf.changePercent).toFixed(2)}%
                    </span>
                  </div>
                  {etf.history && etf.history.length > 0 && (
                    <div className="pb-1">
                      <Sparkline
                        data={etf.history}
                        color={isGraphPositive ? "#a3e635" : "#ef4444"}
                        name={etf.ticker}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-neutral-400 border-t border-white/5 pt-4">
                  <div>
                    <span className="block mb-1">Asset Type</span>
                    <span className="text-neutral-300 font-medium">
                      {etf.assetType || "ETF"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block mb-1">Yield</span>
                    <span className="text-amber-400 font-medium">
                      {etf.metrics?.yield?.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Reddit Communities */}
                {communityLinks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/5">
                    {communityLinks.slice(0, 2).map((community) => (
                      <a
                        key={`${etf.ticker}-${community.name}`}
                        href={community.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 bg-[#FF5700]/10 hover:bg-[#FF5700]/20 border border-[#FF5700]/30 text-[#FF5700] text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors"
                      >
                        <MessageCircle className="w-2.5 h-2.5" />
                        {community.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                {inPortfolio ? (
                  <button
                    onClick={() => handleRemove(etf.ticker)}
                    className="bg-rose-500 hover:bg-rose-600 text-white p-3 rounded-full transform scale-0 group-hover:scale-100 transition-all duration-300 delay-75 shadow-lg"
                    title="Remove from Portfolio"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleAdd(etf)}
                    className="bg-amber-500 hover:bg-amber-600 text-white p-3 rounded-full transform scale-0 group-hover:scale-100 transition-all duration-300 delay-75 shadow-lg"
                    title="Add to Portfolio"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                )}

                <button
                  onClick={() => handleView(etf)}
                  disabled={syncingTicker === etf.ticker}
                  className="bg-white text-black hover:bg-neutral-200 p-3 rounded-full transform scale-0 group-hover:scale-100 transition-all duration-300 delay-100 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  title="View Details"
                >
                  {syncingTicker === etf.ticker ? (
                    <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <ArrowUpRight className="w-6 h-6" />
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-8">
          <motion.button
            onClick={handleLoadMore}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full text-white font-medium transition-all duration-300"
          >
            <span>Load More</span>
            <ChevronDown className="w-4 h-4 group-hover:translate-y-1 transition-transform" />
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}
