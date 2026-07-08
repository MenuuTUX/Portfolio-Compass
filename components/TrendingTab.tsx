"use client";

import { useState, useEffect } from "react";
import { ShoppingBag, TrendingDown, Zap, Sprout, Pickaxe } from "lucide-react";
import { ETF, PortfolioItem } from "@/types";
import { ETFSchema } from "@/schemas/assetSchema";
import { z } from "zod";
import ETFDetailsDrawer from "./ETFDetailsDrawer";
import TrendingSection from "./TrendingSection";
import FearGreedGauge from "./FearGreedGauge";
import ImportPortfolioCard from "./ImportPortfolioCard";
import InstitutionalPortfolios from "./InstitutionalPortfolios";
import { useBatchAddPortfolio } from "@/hooks/useBatchAddPortfolio";
import {
  MAG7_TICKERS,
  JUST_BUY_TICKERS,
  NATURAL_RESOURCES_TICKERS,
  getRedditCommunities,
} from "@/config/tickers";

interface TrendingTabProps {
  onAddToPortfolio: (etf: ETF) => Promise<void>;
  portfolio?: PortfolioItem[];
  onRemoveFromPortfolio?: (ticker: string) => void;
  onImportPortfolio?: (items: PortfolioItem[]) => void;
}

export default function TrendingTab({
  onAddToPortfolio,
  portfolio = [],
  onRemoveFromPortfolio,
  onImportPortfolio,
}: TrendingTabProps) {
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

  const handleInstitutionalAdd = async (items: any[]) => {
    try {
      await batchAddMutation.mutateAsync({ items, replace: true });
    } catch (error) {
      console.error("Failed to add portfolio", error);
    }
  };

  useEffect(() => {
    let cancelled = false;

    // Fast, DB-free batch snapshot: one round trip covers quotes + sparklines
    // for every ticker requested
    const fetchSnapshot = async (tickers: string[]): Promise<ETF[]> => {
      if (tickers.length === 0) return [];
      const res = await fetch(
        `/api/market/snapshot?tickers=${tickers.join(",")}`,
      );
      if (!res.ok) throw new Error(`Snapshot failed: ${res.statusText}`);
      const raw = await res.json();
      try {
        return z.array(ETFSchema).parse(raw);
      } catch (e) {
        console.warn("Snapshot validation failed:", e);
        return raw as ETF[];
      }
    };

    // 1. Curated sections render as soon as their single batch resolves
    const fetchCurated = async () => {
      try {
        const allSpecificTickers = [
          ...MAG7_TICKERS,
          ...JUST_BUY_TICKERS,
          ...NATURAL_RESOURCES_TICKERS,
        ];
        const specificData = await fetchSnapshot(allSpecificTickers);
        if (cancelled) return;

        const specificMap = new Map<string, ETF>();
        specificData.forEach((item) => specificMap.set(item.ticker, item));

        setMag7Items(
          MAG7_TICKERS.map((t) => specificMap.get(t)).filter(
            (i): i is ETF => !!i,
          ),
        );
        setJustBuyItems(
          JUST_BUY_TICKERS.map((t) => specificMap.get(t)).filter(
            (i): i is ETF => !!i,
          ),
        );
        setNaturalResourcesItems(
          NATURAL_RESOURCES_TICKERS.map((t) => specificMap.get(t)).filter(
            (i): i is ETF => !!i,
          ),
        );
      } catch (error) {
        console.error("Failed to fetch curated sections:", error);
      } finally {
        if (!cancelled) setLoadingStocks(false);
      }
    };

    // 2. Movers stream in independently, without holding up the page
    const fetchMovers = async () => {
      try {
        const [gainersRaw, losersRaw] = await Promise.all([
          fetch("/api/market/movers?type=gainers").then((res) =>
            res.ok ? res.json() : { tickers: [] },
          ),
          fetch("/api/market/movers?type=losers").then((res) =>
            res.ok ? res.json() : { tickers: [] },
          ),
        ]);
        if (cancelled) return;

        const topGainers = ((gainersRaw.tickers || []) as string[]).slice(0, 50);
        const topLosers = ((losersRaw.tickers || []) as string[]).slice(0, 50);

        // One combined batch for both lists
        const moversData = await fetchSnapshot([...topGainers, ...topLosers]);
        if (cancelled) return;

        const moversMap = new Map<string, ETF>();
        moversData.forEach((item) => moversMap.set(item.ticker, item));

        const gainersData = topGainers
          .map((t) => moversMap.get(t))
          .filter((i): i is ETF => !!i);
        const losersData = topLosers
          .map((t) => moversMap.get(t))
          .filter((i): i is ETF => !!i);

        setTrendingItems(
          gainersData.sort((a, b) => b.changePercent - a.changePercent),
        );
        setDiscountedItems(
          losersData.sort((a, b) => a.changePercent - b.changePercent),
        );
      } catch (error) {
        console.error("Failed to fetch market movers:", error);
      }
    };

    fetchCurated();
    fetchMovers();

    return () => {
      cancelled = true;
    };
  }, []);

  // Helper to render skeleton
  const renderSkeleton = (count: number = 4) => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-64 bg-surface-card rounded-2xl animate-pulse" />
      ))}
    </div>
  );

  return (
    <section className="py-12 px-4 max-w-7xl mx-auto min-h-full">
      <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Institutional Portfolios Section */}
        <div className="w-full h-full">
          <InstitutionalPortfolios
            onBatchAdd={handleInstitutionalAdd}
            isLoading={batchAddMutation.isPending}
          />
        </div>

        {/* Fear & Greed Index */}
        <div className="w-full h-full">
          <FearGreedGauge className="h-full" />
        </div>

        {/* Import Portfolio Card */}
        <div className="w-full h-full">
          {onImportPortfolio && (
            <ImportPortfolioCard
              onImport={onImportPortfolio}
              className="h-full"
            />
          )}
        </div>
      </div>

      {/* Stock Sections */}
      {loadingStocks ? (
        <>
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-ink">
              <Zap className="w-6 h-6 text-purple-400" />
              MAG-7
            </h2>
            {renderSkeleton(4)}
          </div>
          <div className="mb-12">{renderSkeleton(4)}</div>
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
            communityLookup={(ticker) => getRedditCommunities(ticker).map(c => ({ name: c.displayName, url: c.url }))}
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
            communityLookup={(ticker) => getRedditCommunities(ticker).map(c => ({ name: c.displayName, url: c.url }))}
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
            communityLookup={(ticker) => getRedditCommunities(ticker).map(c => ({ name: c.displayName, url: c.url }))}
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
            communityLookup={(ticker) => getRedditCommunities(ticker).map(c => ({ name: c.displayName, url: c.url }))}
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
            communityLookup={(ticker) => getRedditCommunities(ticker).map(c => ({ name: c.displayName, url: c.url }))}
          />
        </>
      )}

      <ETFDetailsDrawer
        etf={selectedItem}
        onClose={() => setSelectedItem(null)}
        onTickerSelect={(ticker) =>
          setSelectedItem({
            ticker,
            name: ticker,
            price: 0,
            changePercent: 0,
            assetType: "STOCK",
          } as ETF)
        }
      />
    </section>
  );
}
