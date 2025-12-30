'use client';

import { useState, useEffect, useRef } from 'react';
import { ShoppingBag, TrendingDown, Zap, Sprout, Pickaxe, Upload, Loader2, FileImage } from 'lucide-react';
import { ETF, PortfolioItem } from '@/types';
import { cn } from '@/lib/utils';
import { ETFSchema } from '@/schemas/assetSchema';
import { z } from 'zod';
import ETFDetailsDrawer from './ETFDetailsDrawer';
import TrendingSection from './TrendingSection';
import FearGreedGauge from './FearGreedGauge';
import { decodePortfolioWatermark } from '@/lib/steganography';
import { useQueryClient } from '@tanstack/react-query';
import { useMessageDrawer } from './MessageDrawer';

interface TrendingTabProps {
    onAddToPortfolio: (etf: ETF) => Promise<void>;
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

    // Separate loading states
    const [loadingStocks, setLoadingStocks] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    const [selectedItem, setSelectedItem] = useState<ETF | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();
    const { showMessage } = useMessageDrawer();

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

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);

            img.onload = async () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    showMessage({ type: 'error', title: 'Error', message: 'Could not process image.' });
                    setIsUploading(false);
                    return;
                }

                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // Decode
                const result = decodePortfolioWatermark(imageData);

                if (result && result.portfolio.length > 0) {
                    try {
                        const newPortfolioMap: Record<string, any> = {};
                        result.portfolio.forEach(p => {
                            newPortfolioMap[p.ticker] = {
                                ticker: p.ticker,
                                shares: p.shares,
                                weight: p.weight,
                                costBasis: 0
                            };
                        });

                        localStorage.setItem('portfolio_compass_v1', JSON.stringify(newPortfolioMap));
                        await queryClient.invalidateQueries({ queryKey: ['portfolio'] });

                        showMessage({
                            type: 'success',
                            title: 'Portfolio Cloned',
                            message: `Successfully imported ${result.portfolio.length} assets from the image.`
                        });

                    } catch (err) {
                        console.error("Save failed", err);
                        showMessage({ type: 'error', title: 'Save Failed', message: 'Could not save the imported portfolio.' });
                    }
                } else {
                    showMessage({
                        type: 'error',
                        title: 'No Data Found',
                        message: 'Could not find any hidden portfolio data in this image. Make sure it is a valid Portfolio Compass report card.'
                    });
                }

                URL.revokeObjectURL(objectUrl);
                setIsUploading(false);
            };

            img.onerror = () => {
                showMessage({ type: 'error', title: 'Invalid Image', message: 'The file provided is not a valid image.' });
                setIsUploading(false);
            };

            img.src = objectUrl;

        } catch (err) {
            console.error("Upload failed", err);
            setIsUploading(false);
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

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
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png,image/jpeg"
              className="hidden"
            />

            <div className="mb-8">
                <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 relative overflow-hidden mb-6">
                     <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/10 to-blue-900/10" />

                     <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="flex-1 flex justify-center md:justify-start">
                           <FearGreedGauge />
                        </div>

                        <div className="flex-1 flex flex-col items-center md:items-end text-center md:text-right">
                            <h2 className="text-2xl font-bold text-white mb-2">Import Portfolio</h2>
                            <p className="text-neutral-400 text-sm max-w-xs mb-6">
                                Have a Portfolio Compass card? Upload it here to instantly clone the strategy and holdings.
                            </p>

                            <button
                                onClick={handleUploadClick}
                                disabled={isUploading}
                                className="flex items-center gap-3 px-8 py-4 bg-[#161616] hover:bg-[#202020] border border-white/10 hover:border-emerald-500/50 rounded-2xl transition-all group"
                            >
                                <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
                                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                                        {isUploading ? 'Scanning...' : 'Upload Card'}
                                    </div>
                                    <div className="text-xs text-neutral-500">Supports .PNG</div>
                                </div>
                            </button>
                        </div>
                     </div>
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
