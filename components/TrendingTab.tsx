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

    // Pagination state for dynamic sections
    const [trendingPage, setTrendingPage] = useState(1);
    const [discountedPage, setDiscountedPage] = useState(1);
    const [trendingHasMore, setTrendingHasMore] = useState(true);
    const [discountedHasMore, setDiscountedHasMore] = useState(true);

    const MAG7_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];
    const JUSTBUY_TICKERS = ['XEQT.TO', 'VEQT.TO', 'VGRO.TO', 'XGRO.TO', 'VFV.TO', 'VUN.TO', 'ZEB.TO'];
    const NATURAL_RESOURCES_TICKERS = [
        'XLE', 'XOP', 'CVX', 'XOM', 'SHEL', 'COP', // Energy
        'RIO', 'BHP', 'VALE', 'NEM', 'FCX', // Mining
        'GLD', 'SLV', 'GDX', 'SIL', // Precious Metals
        'MOO', 'PHO' // Ag/Water
    ];

    // Helper to fetch data
    const fetchSection = async (params: string) => {
        try {
            const res = await fetch(`/api/etfs/search?${params}`);
            if (!res.ok) throw new Error('Failed to fetch data');
            return await res.json();
        } catch (error) {
            console.error('Fetch error:', error);
            return [];
        }
    };

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                const [best, discounted, mag7, justBuy, resources] = await Promise.all([
                    fetchSection('sort=changePercent&order=desc&limit=8&page=1'),
                    fetchSection('sort=changePercent&order=asc&limit=8&page=1'),
                    fetchSection(`tickers=${MAG7_TICKERS.join(',')}`),
                    fetchSection(`tickers=${JUSTBUY_TICKERS.join(',')}`),
                    fetchSection(`tickers=${NATURAL_RESOURCES_TICKERS.join(',')}`)
                ]);

                setTrendingItems(best);
                setDiscountedItems(discounted);
                setMag7Items(mag7);
                setJustBuyItems(justBuy);
                setNaturalResourcesItems(resources);

                if (best.length < 8) setTrendingHasMore(false);
                if (discounted.length < 8) setDiscountedHasMore(false);

            } catch (error) {
                console.error('Failed to fetch trending data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    const loadMoreTrending = async () => {
        if (!trendingHasMore) return;
        const nextPage = trendingPage + 1;
        const newItems = await fetchSection(`sort=changePercent&order=desc&limit=8&page=${nextPage}`);
        if (newItems.length > 0) {
            setTrendingItems(prev => [...prev, ...newItems]);
            setTrendingPage(nextPage);
            if (newItems.length < 8) setTrendingHasMore(false);
        } else {
            setTrendingHasMore(false);
        }
    };

    const loadMoreDiscounted = async () => {
        if (!discountedHasMore) return;
        const nextPage = discountedPage + 1;
        const newItems = await fetchSection(`sort=changePercent&order=asc&limit=8&page=${nextPage}`);
        if (newItems.length > 0) {
            setDiscountedItems(prev => [...prev, ...newItems]);
            setDiscountedPage(nextPage);
            if (newItems.length < 8) setDiscountedHasMore(false);
        } else {
            setDiscountedHasMore(false);
        }
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

            {/* Dynamic Sections with Load More handled by parent logic injected into section via loadMore prop if we modify TrendingSection,
                OR we can just let TrendingSection handle slicing if we pass all data, but here we are paginating from server.

                Wait, TrendingSection currently has internal "Load More" that just increases slice.
                We need to override that or change how TrendingSection works.

                The `TrendingSection` component I read earlier uses `visibleCount` and slices the passed `items`.
                If I pass the full list of currently fetched items, `TrendingSection` will show the first 10, then 20...

                But here I am appending to `trendingItems` and `discountedItems`.
                So if I have 20 items in `trendingItems`, `TrendingSection` will show 10, then 20.

                However, I need to trigger the *API* fetch when the user hits "Load More" and we are at the end of the list.

                Let's look at `TrendingSection.tsx` again.
                It has `const hasMore = visibleCount < items.length;`.
                It does NOT accept an external `onLoadMore` handler.

                I need to modify `TrendingSection.tsx` to support external load more or just "fetch more" when "load more" is clicked.

                Actually, I'll modify `TrendingSection` to accept `onLoadMore` prop.
            */}
            <TrendingSection
                title="Best"
                items={trendingItems}
                Icon={ShoppingBag}
                theme="emerald"
                onAddToPortfolio={onAddToPortfolio}
                portfolio={portfolio}
                onRemoveFromPortfolio={onRemoveFromPortfolio}
                onSelectItem={setSelectedItem}
                // We need to pass a prop to trigger external load more
                onLoadMoreExternal={loadMoreTrending}
                hasMoreExternal={trendingHasMore}
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
                onLoadMoreExternal={loadMoreDiscounted}
                hasMoreExternal={discountedHasMore}
            />

            <ETFDetailsDrawer etf={selectedItem} onClose={() => setSelectedItem(null)} />
        </section>
    );
}
