'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Plus, ArrowUpRight, ArrowDownRight, ShoppingBag, Tag, Zap, Sprout, Trash2, Check, Pickaxe, ChevronDown, Maximize2 } from 'lucide-react';
import { ETF, PortfolioItem } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import { getAssetIconUrl } from '@/lib/etf-providers';
import { ETFSchema } from '@/schemas/assetSchema';
import { z } from 'zod';
import Sparkline from './Sparkline';

interface TrendingSectionProps {
    title: string;
    items: ETF[];
    Icon: React.ElementType;
    theme: 'emerald' | 'rose' | 'purple' | 'orange' | 'amber';
    onAddToPortfolio: (etf: ETF) => Promise<void>;
    portfolio?: PortfolioItem[];
    onRemoveFromPortfolio?: (ticker: string) => void;
    onSelectItem: (etf: ETF) => void;
}

export default function TrendingSection({
    title,
    items,
    Icon,
    theme,
    onAddToPortfolio,
    portfolio = [],
    onRemoveFromPortfolio,
    onSelectItem
}: TrendingSectionProps) {
    const [visibleCount, setVisibleCount] = useState(8);
    const [flashStates, setFlashStates] = useState<Record<string, 'success' | 'error' | null>>({});
    const [syncingTicker, setSyncingTicker] = useState<string | null>(null);

    const triggerFlash = useCallback((ticker: string, type: 'success' | 'error') => {
        setFlashStates(prev => ({ ...prev, [ticker]: type }));
        setTimeout(() => {
            setFlashStates(prev => ({ ...prev, [ticker]: null }));
        }, 500);
    }, []);

    const handleAdd = async (etf: ETF) => {
        try {
            await onAddToPortfolio(etf);
            triggerFlash(etf.ticker, 'success');
        } catch (error) {
            console.error("Failed to add to portfolio", error);
            triggerFlash(etf.ticker, 'error');
        }
    };

    const handleRemove = (ticker: string) => {
        if (onRemoveFromPortfolio) {
            onRemoveFromPortfolio(ticker);
            triggerFlash(ticker, 'error');
        }
    };

    const handleView = async (etf: ETF) => {
        if (etf.isDeepAnalysisLoaded) {
            onSelectItem(etf);
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

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05
            }
        }
    };

    const isItemInPortfolio = (ticker: string) => {
        return portfolio.some(item => item.ticker === ticker);
    };

    const getThemeStyles = (t: typeof theme) => {
        switch (t) {
            case 'rose': return {
                bg: "bg-rose-500/20", text: "text-rose-400", border: "hover:border-rose-500/30", shadow: "hover:shadow-rose-500/20",
                tagBg: "bg-rose-500", tagText: "SALE", tagIcon: Tag
            };
            case 'purple': return {
                bg: "bg-purple-500/20", text: "text-purple-400", border: "hover:border-purple-500/30", shadow: "hover:shadow-purple-500/20",
                tagBg: "bg-purple-500", tagText: "ELITE", tagIcon: Zap
            };
            case 'orange': return {
                tagBg: "bg-[#FF5700]", tagText: "REDDIT", tagIcon: Sprout
            };
            case 'amber': return {
                bg: "bg-amber-500/20", text: "text-amber-400", border: "hover:border-amber-500/30", shadow: "hover:shadow-amber-500/20",
                tagBg: "bg-amber-500", tagText: "RESOURCE", tagIcon: Pickaxe
            };
            default: return {
                bg: "bg-emerald-500/20", text: "text-emerald-400", border: "hover:border-white/20", shadow: "hover:shadow-emerald-500/10",
                tagBg: "bg-emerald-500", tagText: "HOT", tagIcon: TrendingUp
            };
        }
    };

    const styles = getThemeStyles(theme);
    const visibleItems = items.slice(0, visibleCount);
    const hasMore = visibleCount < items.length;

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 8);
    };

    return (
        <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
                <div className={cn("p-3 rounded-xl", styles.bg)}>
                    <Icon className={cn("w-6 h-6", styles.text)} />
                </div>
                <h2 className="text-3xl font-bold text-white tracking-tight">{title}</h2>
                <span className="text-neutral-500 text-sm font-medium ml-2">
                    ({visibleItems.length} of {items.length})
                </span>
            </div>

            <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
                {visibleItems.map((etf) => {
                    const inPortfolio = isItemInPortfolio(etf.ticker);
                    const flashState = flashStates[etf.ticker];

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
                            animate={flashState ? { x: [0, -5, 5, -5, 5, 0], opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                            className={cn(
                                "group relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1",
                                styles.border, styles.shadow,
                                inPortfolio && "shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)] border-emerald-500/30"
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

                            <div className={cn("absolute top-3 right-3 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg z-10", styles.tagBg)}>
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
                                            <img
                                                src={getAssetIconUrl(etf.ticker, etf.name, etf.assetType)!}
                                                alt={`${etf.ticker} logo`}
                                                className="w-full h-full object-contain"
                                                loading="lazy"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.parentElement!.style.display = 'none';
                                                }}
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-xl font-bold text-white mb-1">{etf.ticker}</h3>
                                        <p className="text-xs text-neutral-400 line-clamp-1">{etf.name}</p>
                                    </div>
                                </div>

                                <div className="flex justify-between items-end mb-4">
                                    <div>
                                        <span className="block text-2xl font-bold text-white mb-1">{formatCurrency(etf.price)}</span>
                                        <span className={cn(
                                            "flex items-center text-sm font-medium",
                                            etf.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                                        )}>
                                            {etf.changePercent >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                            {Math.abs(etf.changePercent).toFixed(2)}%
                                        </span>
                                    </div>
                                    {etf.history && etf.history.length > 0 && (
                                        <div className="pb-1">
                                            <Sparkline
                                                data={etf.history}
                                                color={isGraphPositive ? '#10b981' : '#f43f5e'}
                                                name={etf.ticker}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs text-neutral-500 border-t border-white/5 pt-4">
                                    <div>
                                        <span className="block mb-1">Asset Type</span>
                                        <span className="text-neutral-300 font-medium">{etf.assetType || 'ETF'}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block mb-1">Yield</span>
                                        <span className="text-emerald-400 font-medium">{etf.metrics?.yield?.toFixed(2)}%</span>
                                    </div>
                                </div>
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
                                        className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-full transform scale-0 group-hover:scale-100 transition-all duration-300 delay-75 shadow-lg"
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
                    <button
                        onClick={handleLoadMore}
                        className="group flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full text-white font-medium transition-all duration-300"
                    >
                        <span>Load More</span>
                        <ChevronDown className="w-4 h-4 group-hover:translate-y-1 transition-transform" />
                    </button>
                </div>
            )}
        </div>
    );
}
