'use client';

import { useState, useEffect } from 'react';
import { ShoppingBag, TrendingDown, Zap, Sprout, Pickaxe } from 'lucide-react';
import { ETF, PortfolioItem } from '@/types';
import { cn } from '@/lib/utils';
import { ETFSchema } from '@/schemas/assetSchema';
import { z } from 'zod';
import ETFDetailsDrawer from './ETFDetailsDrawer';
import TrendingSection from './TrendingSection';
import FearGreedGauge from './FearGreedGauge';
import ImportPortfolioButton from './ImportPortfolioButton';
import InstitutionalPortfolios from './InstitutionalPortfolios';
import { useBatchAddPortfolio } from '@/hooks/useBatchAddPortfolio';

interface TrendingTabProps {
    onAddToPortfolio: (etf: ETF) => Promise<void>;
    portfolio?: PortfolioItem[];
    onRemoveFromPortfolio?: (ticker: string) => void;
    onImportPortfolio?: (items: PortfolioItem[]) => void;
}

export default function TrendingTab({ onAddToPortfolio, portfolio = [], onRemoveFromPortfolio, onImportPortfolio }: TrendingTabProps) {
    // Separate state for different sections to allow progressive loading
    const [trendingItems, setTrendingItems] = useState<ETF[]>([]);
    const [discountedItems, setDiscountedItems] = useState<ETF[]>([]);
    const [mag7Items, setMag7Items] = useState<ETF[]>([]);
    const [justBuyItems, setJustBuyItems] = useState<ETF[]>([]);
    const [naturalResourcesItems, setNaturalResourcesItems] = useState<ETF[]>([]);

    // Separate loading states
    const [loadingStocks, setLoadingStocks] = useState(true);

    const [selectedItem, setSelectedItem] = useState<ETF | null>(null);

    const batchAddMutation = useBatchAddPortfolio();

    const MAG7_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];
    const JUSTBUY_TICKERS = ['XEQT.TO', 'VEQT.TO', 'VGRO.TO', 'XGRO.TO', 'VFV.TO', 'VUN.TO', 'ZEB.TO'];
    const NATURAL_RESOURCES_TICKERS = [
        'XLE', 'XOP', 'CVX', 'XOM', 'SHEL', 'COP', // Energy
        'RIO', 'BHP', 'VALE', 'NEM', 'FCX', // Mining
        'GLD', 'SLV', 'GDX', 'SIL', // Precious Metals
        'MOO', 'PHO' // Ag/Water
    ];

    useEffect(() => {
        // 1. Fetch Stocks (Specific & General)
        const fetchStocks = async () => {
            setLoadingStocks(true);
            try {
                // Collect all specific tickers to fetch
                const allSpecificTickers = [
                    ...MAG7_TICKERS,
                    ...JUSTBUY_TICKERS,
                    ...NATURAL_RESOURCES_TICKERS
                ];

                // Fetch data in parallel
                const promises = [
                    fetch(`/api/etfs/search?tickers=${allSpecificTickers.join(',')}&includeHistory=true`).then(res => res.json()),
                    fetch('/api/market/movers?type=gainers').then(res => res.json()),
                    fetch('/api/market/movers?type=losers').then(res => res.json())
                ];

                const [specificDataRaw, gainersRaw, losersRaw] = await Promise.all(promises);

                let specificData: ETF[] = [];
                try {
                    specificData = z.array(ETFSchema).parse(specificDataRaw);
                } catch (e) {
                     console.warn('API response validation failed for specific items:', e);
                     specificData = specificDataRaw as ETF[];
                }

                // Fetch details for gainers and losers
                const gainerTickers = (gainersRaw.tickers || []) as string[];
                const loserTickers = (losersRaw.tickers || []) as string[];

                // Limit to 50 to allow better "load more" experience
                const topGainers = gainerTickers.slice(0, 50);
                const topLosers = loserTickers.slice(0, 50);

                let gainersData: ETF[] = [];
                let losersData: ETF[] = [];

                if (topGainers.length > 0) {
                    const res = await fetch(`/api/etfs/search?tickers=${topGainers.join(',')}&includeHistory=true`);
                    const raw = await res.json();
                    try {
                        gainersData = z.array(ETFSchema).parse(raw);
                    } catch (e) {
                         console.warn('API response validation failed for gainers:', e);
                         gainersData = raw as ETF[];
                    }
                }

                if (topLosers.length > 0) {
                    const res = await fetch(`/api/etfs/search?tickers=${topLosers.join(',')}&includeHistory=true`);
                    const raw = await res.json();
                     try {
                        losersData = z.array(ETFSchema).parse(raw);
                    } catch (e) {
                         console.warn('API response validation failed for losers:', e);
                         losersData = raw as ETF[];
                    }
                }

                // Populate sections
                setTrendingItems(gainersData.sort((a, b) => b.changePercent - a.changePercent)); // Ensure sorted by %
                setDiscountedItems(losersData.sort((a, b) => a.changePercent - b.changePercent)); // Ensure sorted by % ascending (most negative first)

                const specificMap = new Map<string, ETF>();
                specificData.forEach(item => specificMap.set(item.ticker, item));

                setMag7Items(MAG7_TICKERS.map(t => specificMap.get(t)).filter((i): i is ETF => !!i));
                setJustBuyItems(JUSTBUY_TICKERS.map(t => specificMap.get(t)).filter((i): i is ETF => !!i));
                setNaturalResourcesItems(NATURAL_RESOURCES_TICKERS.map(t => specificMap.get(t)).filter((i): i is ETF => !!i));

            } catch (error) {
                console.error('Failed to fetch trending stocks:', error);
            } finally {
                setLoadingStocks(false);
            }
        };

        fetchStocks();
    }, []);

    // Helper to render skeleton
    const renderSkeleton = (count: number = 4) => (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="h-64 bg-white/5 rounded-2xl animate-pulse" />
            ))}
        </div>
    );

    return (
        <section className="py-12 px-4 max-w-7xl mx-auto min-h-full">

            <div className="mb-8 flex flex-col md:flex-row items-start gap-6 relative">

                {/* Institutional Portfolios Section */}
                <div className="w-full md:w-1/3">
                    <InstitutionalPortfolios
                        onBatchAdd={batchAddMutation.mutate}
                        isLoading={batchAddMutation.isPending}
                    />
                </div>

                {/* Fear & Greed Index */}
                <div className="flex-1 w-full">
                    <FearGreedGauge />
                </div>

                {/* Upload Button aligned top-right as per mockup */}
                <div className="absolute top-4 right-4 z-10 hidden md:block">
                    {onImportPortfolio && (
                        <ImportPortfolioButton onImport={onImportPortfolio} />
                    )}
                </div>
            </div>

            {/* Stock Sections */}
            {loadingStocks ? (
                <>
                    <div className="mb-12">
                         <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
                            <Zap className="w-6 h-6 text-purple-400" />
                            MAG-7
                        </h2>
                        {renderSkeleton(4)}
                    </div>
                     <div className="mb-12">
                        {renderSkeleton(4)}
                    </div>
                </>
            ) : (
                <>
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
                </>
            )}

            <ETFDetailsDrawer
                etf={selectedItem}
                onClose={() => setSelectedItem(null)}
                onTickerSelect={(ticker) => setSelectedItem({ ticker, name: ticker, price: 0, changePercent: 0, assetType: 'STOCK' } as ETF)}
            />
        </section>
    );
}
