"use client";

import Image from "next/image";
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
import { HelpTip } from "./ui/HelpTip";

interface TrendingSectionProps {
  title: string;
  items: ETF[];
  Icon: React.ElementType;
  theme: "emerald" | "rose" | "purple" | "orange" | "amber";
  onAddToPortfolio: (etf: ETF) => Promise<void>;
  portfolio?: PortfolioItem[];
  onRemoveFromPortfolio?: (ticker: string) => void;
  onSelectItem: (etf: ETF) => void;
  communityLookup?: (
    ticker: string,
    assetType?: string,
  ) => { name: string; url: string }[];
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

  // Open the drawer immediately — it streams its own chart and metrics from
  // the fast market endpoints and hydrates deep data in the background.
  const handleView = (etf: ETF) => {
    onSelectItem(etf);
  };

  const isItemInPortfolio = (ticker: string) => {
    return portfolio.some(
      (item) => item.ticker.toUpperCase() === ticker.toUpperCase(),
    );
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
          bg: "bg-[#FF5700]/20",
          text: "text-[#FF5700]",
          border: "hover:border-[#FF5700]/30",
          shadow: "hover:shadow-[#FF5700]/20",
          tagBg: "bg-[#FF5700]",
          tagText: "REDDIT",
          tagIcon: Sprout,
        };
      case "amber":
        return {
          bg: "bg-amber-500/20",
          text: "text-amber-400",
          border: "hover:border-amber-500/30",
          shadow: "hover:shadow-amber-500/20",
          tagBg: "bg-amber-500",
          tagText: "RESOURCE",
          tagIcon: Pickaxe,
        };
      default:
        return {
          bg: "bg-emerald-500/20",
          text: "text-emerald-400",
          border: "hover:border-hairline-strong",
          shadow: "hover:shadow-emerald-500/10",
          tagBg: "bg-emerald-500",
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
        <div className="flex items-center gap-4">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            className={cn("p-3 rounded-xl", styles.bg)}
          >
            <Icon className={cn("w-6 h-6", styles.text)} />
          </motion.div>
          <div>
            <h2 className="text-3xl font-bold text-ink tracking-tight leading-tight">
              {title}
            </h2>
            <div
              className={cn("h-[3px] w-10 rounded-full mt-1.5 mb-1.5", styles.tagBg)}
            />
            <div className="flex items-center gap-3">
              <span className="text-muted text-sm font-medium">
                {visibleItems.length} of {items.length} assets
              </span>
              {ownedCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-xs font-medium px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3" />
                  {ownedCount} owned
                </span>
              )}
            </div>
          </div>
        </div>
        {items.length > 8 && (
          <div className="hidden md:flex items-center gap-2 text-sm text-muted">
            <span className="px-3 py-1 bg-surface-card rounded-full border border-hairline">
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
          className="bg-surface-card border border-hairline border-dashed rounded-2xl p-8 text-center"
        >
          <div className={cn("w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4", styles.bg)}>
            <Icon className={cn("w-8 h-8", styles.text)} />
          </div>
          <h3 className="text-ink font-medium mb-2">Loading {title}...</h3>
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
            ? communityLookup(etf.ticker, etf.assetType)
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
                "group relative bg-surface-card border border-hairline rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1",
                styles.border,
                styles.shadow,
                inPortfolio &&
                  "shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)] border-emerald-500/30",
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
                        ? "bg-emerald-500/20"
                        : "bg-rose-500/20",
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

              {/* Green Blur Overlay for Owned Items */}
              {inPortfolio && (
                <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />
              )}

              <div className="p-5">
                {/* Portfolio Indicator */}
                {inPortfolio && (
                  <div className="inline-flex items-center gap-1 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-xs font-bold px-2 py-1 rounded-full mb-3 shadow-sm">
                    <Check className="w-3 h-3" />
                    OWNED
                  </div>
                )}

                <div className="flex items-start gap-3 mb-4">
                  {getAssetIconUrl(etf.ticker, etf.name, etf.assetType) && (
                    <div className="w-10 h-10 flex items-center justify-center shrink-0">
                      <Image
                        src={
                          getAssetIconUrl(etf.ticker, etf.name, etf.assetType)!
                        }
                        alt={`${etf.ticker} logo`}
                        width={40}
                        height={40}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.parentElement!.style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-ink mb-1">
                      {etf.ticker}
                    </h3>
                    <p className="text-xs text-neutral-400 line-clamp-1">
                      {etf.name}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-end mb-4">
                  <div>
                    <span className="block text-2xl font-bold text-ink mb-1">
                      {formatCurrency(etf.price)}
                    </span>
                    <span
                      className={cn(
                        "flex items-center text-sm font-medium",
                        etf.changePercent >= 0
                          ? "text-emerald-400"
                          : "text-rose-400",
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
                    <div className="pb-1 pr-1 rounded-lg bg-surface-soft/60">
                      <Sparkline
                        data={etf.history}
                        color={isGraphPositive ? "#10b981" : "#f43f5e"}
                        name={etf.ticker}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 border-t border-hairline pt-4">
                  <span className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted bg-surface-soft rounded-lg py-1.5">
                    {etf.assetType || "ETF"}
                  </span>
                  <span className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded-lg py-1.5">
                    {(etf.metrics?.yield ?? etf.dividendYield ?? 0).toFixed(2)}%{" "}
                    <HelpTip term="Yield" showIcon={false} className="text-emerald-400/80">
                      yield
                    </HelpTip>
                  </span>
                </div>

                {/* Reddit Communities */}
                {communityLinks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-hairline">
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
              <div className="absolute inset-0 bg-dune/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
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
                    className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-full transform scale-0 group-hover:scale-100 transition-all duration-300 delay-75 shadow-lg"
                    title="Add to Portfolio"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                )}

                <button
                  onClick={() => handleView(etf)}
                  className="bg-white text-black hover:bg-neutral-200 p-3 rounded-full transform scale-0 group-hover:scale-100 transition-all duration-300 delay-100 shadow-lg"
                  title="View Details"
                >
                  <ArrowUpRight className="w-6 h-6" />
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
            className="group flex items-center gap-2 px-6 py-3 bg-surface-card hover:bg-surface-soft border border-hairline hover:border-hairline-strong rounded-full text-ink font-medium transition-all duration-300"
          >
            <span>Load More</span>
            <ChevronDown className="w-4 h-4 group-hover:translate-y-1 transition-transform" />
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}
