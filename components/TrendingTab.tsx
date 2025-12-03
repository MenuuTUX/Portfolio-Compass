'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Plus, ArrowUpRight, ArrowDownRight, ShoppingBag, Tag, Zap, Sprout, Trash2, Check, Pickaxe } from 'lucide-react';
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
    const [naturalResourcesItems, setNaturalResourcesItems] = useState<ETF[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<ETF | null>(null);

    const MAG7_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];
    const JUSTBUY_TICKERS = ['XEQT.TO', 'VEQT.TO', 'VGRO.TO', 'XGRO.TO', 'VFV.TO', 'VUN.TO', 'ZEB.TO'];
    const NATURAL_RESOURCES_TICKERS = [
        'XLE', 'XOP', 'CVX', 'XOM', 'SHEL', 'COP', // Energy
        'RIO', 'BHP', 'VALE', 'NEM', 'FCX', // Mining
        'GLD', 'SLV', 'GDX', 'SIL', // Precious Metals
        'MOO', 'PHO' // Ag/Water
    ];

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

                // Filter for Natural Resources
                const naturalResources = data.filter(item => NATURAL_RESOURCES_TICKERS.includes(item.ticker));
                setNaturalResourcesItems(naturalResources);

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

    const renderSection = (title: string, items: ETF[], Icon: React.ElementType, theme: 'emerald' | 'rose' | 'purple' | 'orange' | 'amber') => {
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

        return (
            <div className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className={cn("p-3 rounded-xl", styles.bg)}>
                        <Icon className={cn("w-6 h-6", styles.text)} />
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
                                    styles.border, styles.shadow,
                                    inPortfolio && "shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)] border-emerald-500/30"
                                )}
                            >
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
    };

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
            {renderSection("MAG-7", mag7Items, Zap, 'purple')}
            {renderSection("Natural Resources", naturalResourcesItems, Pickaxe, 'amber')}
            {renderSection("r/justbuy...", justBuyItems, Sprout, 'orange')}
            {renderSection("Best", trendingItems, ShoppingBag, 'emerald')}
            {renderSection("Discounted", discountedItems, TrendingDown, 'rose')}

            <ETFDetailsDrawer etf={selectedItem} onClose={() => setSelectedItem(null)} />
        </section>
    );
}
