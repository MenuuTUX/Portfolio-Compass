'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Plus, ArrowUpRight, ArrowDownRight, ShoppingBag, Tag, Zap, Sprout, Trash2, Check, Pickaxe } from 'lucide-react';
import { ETF, PortfolioItem } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import ETFDetailsDrawer from './ETFDetailsDrawer';
import TrendingSection from './TrendingSection';

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
                setTrendingItems(sortedByGain);

                // Sort by changePercent for "Discounted" (Top Losers)
                const sortedByLoss = [...data].sort((a, b) => a.changePercent - b.changePercent);
                setDiscountedItems(sortedByLoss);

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
            <TrendingSection
                title="MAG-7"
                items={mag7Items}
                Icon={Zap}
                theme="purple"
                onAddToPortfolio={onAddToPortfolio}
                portfolio={portfolio}
                onRemoveFromPortfolio={onRemoveFromPortfolio}
                onSelectItem={setSelectedItem}
            />
            <TrendingSection
                title="Natural Resources"
                items={naturalResourcesItems}
                Icon={Pickaxe}
                theme="amber"
                onAddToPortfolio={onAddToPortfolio}
                portfolio={portfolio}
                onRemoveFromPortfolio={onRemoveFromPortfolio}
                onSelectItem={setSelectedItem}
            />
            <TrendingSection
                title="r/justbuy..."
                items={justBuyItems}
                Icon={Sprout}
                theme="orange"
                onAddToPortfolio={onAddToPortfolio}
                portfolio={portfolio}
                onRemoveFromPortfolio={onRemoveFromPortfolio}
                onSelectItem={setSelectedItem}
            />
            <TrendingSection
                title="Best"
                items={trendingItems}
                Icon={ShoppingBag}
                theme="emerald"
                onAddToPortfolio={onAddToPortfolio}
                portfolio={portfolio}
                onRemoveFromPortfolio={onRemoveFromPortfolio}
                onSelectItem={setSelectedItem}
            />
            <TrendingSection
                title="Discounted"
                items={discountedItems}
                Icon={TrendingDown}
                theme="rose"
                onAddToPortfolio={onAddToPortfolio}
                portfolio={portfolio}
                onRemoveFromPortfolio={onRemoveFromPortfolio}
                onSelectItem={setSelectedItem}
            />

            <ETFDetailsDrawer etf={selectedItem} onClose={() => setSelectedItem(null)} />
        </section>
    );
}
