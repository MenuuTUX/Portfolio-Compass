'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Plus, ArrowUpRight, ArrowDownRight, ShoppingBag, Tag, Zap, Sprout, Trash2, Check } from 'lucide-react';
import { ETF, PortfolioItem } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import ETFDetailsDrawer from './ETFDetailsDrawer';

interface TrendingTabProps {
    onAddToPortfolio: (etf: ETF) => void;
    portfolio?: PortfolioItem[];
    onRemoveFromPortfolio?: (ticker: string) => void;
}

export default function TrendingTab({ onAddToPortfolio, portfolio = [], onRemoveFromPortfolio }: TrendingTabProps) {
    const [trendingItems, setTrendingItems] = useState<ETF[]>([]);
    const [discountedItems, setDiscountedItems] = useState<ETF[]>([]);
    const [mag7Items, setMag7Items] = useState<ETF[]>([]);
    const [justBuyItems, setJustBuyItems] = useState<ETF[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<ETF | null>(null);

    const MAG7_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];
    const JUSTBUY_TICKERS = ['XEQT.TO', 'VEQT.TO', 'VGRO.TO', 'XGRO.TO', 'VFV.TO', 'VUN.TO', 'ZEB.TO'];

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch all data to sort client-side for now
                const res = await fetch('/api/etfs/search?query=');
                if (!res.ok) throw new Error('Failed to fetch data');
                const data: ETF[] = await res.json();

                // Sort by changePercent for "BEST" (Top Gainers)
                const sortedByGain = [...data].sort((a, b) => b.changePercent - a.changePercent);
                setTrendingItems(sortedByGain.slice(0, 8));

                // Sort by changePercent for "Discounted" (Top Losers)
                const sortedByLoss = [...data].sort((a, b) => a.changePercent - b.changePercent);
                setDiscountedItems(sortedByLoss.slice(0, 8));

                // Filter for MAG 7
                const mag7 = data.filter(item => MAG7_TICKERS.includes(item.ticker));
                setMag7Items(mag7);

                // Filter for Just Buy
                const justBuy = data.filter(item => JUSTBUY_TICKERS.includes(item.ticker));
                setJustBuyItems(justBuy);

            } catch (error) {
                console.error('Failed to fetch trending data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    const isItemInPortfolio = (ticker: string) => {
        return portfolio.some(item => item.ticker === ticker);
    };

    const renderSection = (title: string, items: ETF[], Icon: React.ElementType, isDiscounted: boolean, isSpecial: boolean = false) => (
        <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
                <div className={cn("p-3 rounded-xl",
                    isDiscounted ? "bg-rose-500/20" :
                        isSpecial ? "bg-purple-500/20" : "bg-emerald-500/20"
                )}>
                    <Icon className={cn("w-6 h-6",
                        isDiscounted ? "text-rose-400" :
                            isSpecial ? "text-purple-400" : "text-emerald-400"
                    )} />
                </div>
                <h2 className="text-3xl font-bold text-white tracking-tight">{title}</h2>
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
                {items.map((etf) => {
                    const inPortfolio = isItemInPortfolio(etf.ticker);
                    return (
                        <motion.div
                            key={etf.ticker}
                            variants={item}
                            className={cn(
                                "group relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1",
                                isSpecial ? "hover:shadow-purple-500/20 hover:border-purple-500/30" : "hover:border-white/20 hover:shadow-emerald-500/10",
                                inPortfolio && "shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)] border-emerald-500/30"
                            )}
                        >
                            {/* "Sale" Tag for Discounted */}
                            {isDiscounted && (
                                <div className="absolute top-3 right-3 bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg z-10">
                                    <Tag className="w-3 h-3" />
                                    SALE
                                </div>
                            )}

                            {/* "Hot" Tag for Trending */}
                            {!isDiscounted && !isSpecial && (
                                <div className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg z-10">
                                    <TrendingUp className="w-3 h-3" />
                                    HOT
                                </div>
                            )}

                            {/* "Elite" Tag for Special */}
                            {isSpecial && (
                                <div className="absolute top-3 right-3 bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg z-10">
                                    <Zap className="w-3 h-3" />
                                    ELITE
                                </div>
                            )}

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

                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">{etf.ticker}</h3>
                                        <p className="text-xs text-neutral-400 line-clamp-1">{etf.name}</p>
                                    </div>
                                </div>

                                <div className="flex items-baseline gap-2 mb-4">
                                    <span className="text-2xl font-bold text-white">{formatCurrency(etf.price)}</span>
                                    <span className={cn(
                                        "flex items-center text-sm font-medium",
                                        etf.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {etf.changePercent >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                        {Math.abs(etf.changePercent).toFixed(2)}%
                                    </span>
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
                                        onClick={() => onRemoveFromPortfolio?.(etf.ticker)}
                                        className="bg-rose-500 hover:bg-rose-600 text-white p-3 rounded-full transform scale-0 group-hover:scale-100 transition-all duration-300 delay-75 shadow-lg"
                                        title="Remove from Portfolio"
                                    >
                                        <Trash2 className="w-6 h-6" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onAddToPortfolio(etf)}
                                        className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-full transform scale-0 group-hover:scale-100 transition-all duration-300 delay-75 shadow-lg"
                                        title="Add to Portfolio"
                                    >
                                        <Plus className="w-6 h-6" />
                                    </button>
                                )}

                                <button
                                    onClick={() => setSelectedItem(etf)}
                                    className="bg-white text-black hover:bg-neutral-200 p-3 rounded-full transform scale-0 group-hover:scale-100 transition-all duration-300 delay-100 shadow-lg"
                                    title="View Details"
                                >
                                    <ArrowUpRight className="w-6 h-6" />
                                </button>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>
        </div>
    );



    if (loading) {
        return (
            <div className="py-12 px-4 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="h-64 bg-white/5 rounded-2xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <section className="py-12 px-4 max-w-7xl mx-auto h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar">
            {renderSection("MAG-7", mag7Items, Zap, false, true)}
            {renderSection("r/justbuy...", justBuyItems, Sprout, false, true)}
            {renderSection("Best", trendingItems, ShoppingBag, false)}
            {renderSection("Discounted", discountedItems, TrendingDown, true)}

            <ETFDetailsDrawer etf={selectedItem} onClose={() => setSelectedItem(null)} />
        </section>
    );
}
