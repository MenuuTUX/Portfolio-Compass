'use client';

import { useState, useEffect } from 'react';
import { ShoppingBag, TrendingDown, Zap, Sprout, Pickaxe, Coins } from 'lucide-react';
import { ETF, PortfolioItem } from '@/types';
import { cn } from '@/lib/utils';
import { ETFSchema } from '@/schemas/assetSchema';
import { z } from 'zod';
import ETFDetailsDrawer from './ETFDetailsDrawer';
import TrendingSection from './TrendingSection';
import FearGreedGauge from './FearGreedGauge';

interface TrendingTabProps {
    onAddToPortfolio: (etf: ETF) => void;
    portfolio?: PortfolioItem[];
    onRemoveFromPortfolio?: (ticker: string) => void;
}

export default function TrendingTab({ onAddToPortfolio, portfolio = [], onRemoveFromPortfolio }: TrendingTabProps) {
    // Separate state for different sections to allow progressive loading
    const [trendingItems, setTrendingItems] = useState<ETF[]>([]);
    const [discountedItems, setDiscountedItems] = useState<ETF[]>([]);
    const [mag7Items, setMag7Items] = useState<ETF[]>([]);
    const [justBuyItems, setJustBuyItems] = useState<ETF[]>([]);
    const [naturalResourcesItems, setNaturalResourcesItems] = useState<ETF[]>([]);
    const [cryptoItems, setCryptoItems] = useState<ETF[]>([]);

    // Separate loading states
    const [loadingStocks, setLoadingStocks] = useState(true);
    const [loadingCrypto, setLoadingCrypto] = useState(true);

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

                // Fetch specific tickers
                // We run these in parallel to speed up if the API supports concurrent connections,
                // though the browser might limit connections to the same host.
                // However, splitting the request might help if the backend serializes processing per request but can handle multiple requests in parallel workers.

                const specificPromise = fetch(`/api/etfs/search?tickers=${allSpecificTickers.join(',')}`);
                const generalPromise = fetch('/api/etfs/search?query=&limit=100');

                const [specificRes, generalRes] = await Promise.all([specificPromise, generalPromise]);

                let specificData: ETF[] = [];
                if (specificRes.ok) {
                    const rawSpecificData = await specificRes.json();
                    try {
                        specificData = z.array(ETFSchema).parse(rawSpecificData);
                    } catch (e) {
                        console.warn('API response validation failed for specific items:', e);
                        specificData = rawSpecificData as ETF[];
                    }
                }

                let generalData: ETF[] = [];
                if (generalRes.ok) {
                    const rawGeneralData = await generalRes.json();
                     try {
                        generalData = z.array(ETFSchema).parse(rawGeneralData);
                    } catch (e) {
                        console.warn('API response validation failed for general items:', e);
                        generalData = rawGeneralData as ETF[];
                    }
                }

                // Combine data
                const combinedMap = new Map<string, ETF>();
                [...generalData, ...specificData].forEach(item => {
                    combinedMap.set(item.ticker, item);
                });
                const allData = Array.from(combinedMap.values());
                const validData = allData.filter(d => d.price > 0);

                // Populate sections
                setTrendingItems([...validData].sort((a, b) => b.changePercent - a.changePercent).slice(0, 50));
                setDiscountedItems([...validData].sort((a, b) => a.changePercent - b.changePercent).slice(0, 50));
                setMag7Items(validData.filter(item => MAG7_TICKERS.includes(item.ticker)));
                setJustBuyItems(validData.filter(item => JUSTBUY_TICKERS.includes(item.ticker)));
                setNaturalResourcesItems(validData.filter(item => NATURAL_RESOURCES_TICKERS.includes(item.ticker)));

            } catch (error) {
                console.error('Failed to fetch trending stocks:', error);
            } finally {
                setLoadingStocks(false);
            }
        };

        // 2. Fetch Crypto (Independent)
        const fetchCrypto = async () => {
            setLoadingCrypto(true);
            try {
                const ids = 'bitcoin,ethereum,solana,cardano,ripple';
                const res = await fetch(`/api/proxy?path=simple/price&ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
                if (!res.ok) throw new Error('Failed to fetch crypto data');
                const data = await res.json();

                const cryptos: ETF[] = Object.keys(data).map(key => {
                    const item = data[key];
                    return {
                        ticker: key.toUpperCase(),
                        name: key.charAt(0).toUpperCase() + key.slice(1),
                        price: item.usd,
                        changePercent: item.usd_24h_change || 0,
                        assetType: 'CRYPTO',
                        history: [],
                        metrics: { yield: 0, mer: 0 },
                        allocation: { equities: 0, bonds: 0, cash: 0 },
                        sectors: {},
                    };
                });

                setCryptoItems(cryptos);
            } catch (error) {
                console.error('Failed to fetch crypto data:', error);
            } finally {
                setLoadingCrypto(false);
            }
        };

        fetchStocks();
        fetchCrypto();
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
        <section className="py-12 px-4 max-w-7xl mx-auto h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar">

            <div className="mb-8">
                <FearGreedGauge />
            </div>

            {/* Crypto Section */}
            {loadingCrypto ? (
                <div className="mb-12">
                     <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
                        <Coins className="w-6 h-6 text-rose-400" />
                        Crypto
                    </h2>
                    {renderSkeleton(4)}
                </div>
            ) : (
                <TrendingSection
                    title="Crypto"
                    items={cryptoItems}
                    Icon={Coins}
                    theme="rose"
                    onAddToPortfolio={onAddToPortfolio}
                    portfolio={portfolio}
                    onRemoveFromPortfolio={onRemoveFromPortfolio}
                    onSelectItem={setSelectedItem}
                />
            )}

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

            <ETFDetailsDrawer etf={selectedItem} onClose={() => setSelectedItem(null)} />
        </section>
    );
}
