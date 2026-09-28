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
import { BatchAddItem, useBatchAddPortfolio } from "@/hooks/useBatchAddPortfolio";
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

const MoversResponseSchema = z.object({
  tickers: z.array(z.string()).catch([]),
});

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

  const handleInstitutionalAdd = async (items: BatchAddItem[]) => {
    await batchAddMutation.mutateAsync({ items, replace: true });
  };

  useEffect(() => {
    let cancelled = false;

    const fetchSnapshot = async (
      tickers: string[],
      includeHistory = false,
    ): Promise<ETF[]> => {
      if (tickers.length === 0) return [];
      const res = await fetch(
        `/api/market/snapshot?tickers=${tickers.join(",")}&history=${includeHistory}`,
      );
      if (!res.ok) throw new Error(`Snapshot failed: ${res.statusText}`);
      const raw = await res.json();
      try {
        return z.array(ETFSchema).parse(raw);
      } catch (e) {
        console.warn("Snapshot validation failed:", e);
        return [];
      }
    };

    // 1. Curated sections render as soon as their single batch resolves
    const fetchCurated = async () => {
      const allSpecificTickers = [
        ...MAG7_TICKERS,
        ...JUST_BUY_TICKERS,
        ...NATURAL_RESOURCES_TICKERS,
      ];
      const applyCurated = (data: ETF[]) => {
        const specificMap = new Map(data.map((item) => [item.ticker, item]));
        setMag7Items(
          MAG7_TICKERS.map((ticker) => specificMap.get(ticker)).filter(
            (item): item is ETF => !!item,
          ),
        );
        setJustBuyItems(
          JUST_BUY_TICKERS.map((ticker) => specificMap.get(ticker)).filter(
            (item): item is ETF => !!item,
          ),
        );
        setNaturalResourcesItems(
          NATURAL_RESOURCES_TICKERS.map((ticker) => specificMap.get(ticker)).filter(
            (item): item is ETF => !!item,
          ),
        );
      };
      try {
        const specificData = await fetchSnapshot(allSpecificTickers);
        if (cancelled) return;
        applyCurated(specificData);
        void fetchSnapshot(allSpecificTickers, true)
          .then((details) => { if (!cancelled) applyCurated(details); })
          .catch((error) => console.warn("Curated chart history failed:", error));
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

        const topGainers = MoversResponseSchema.parse(gainersRaw).tickers.slice(
          0,
          50,
        );
        const topLosers = MoversResponseSchema.parse(losersRaw).tickers.slice(
          0,
          50,
        );

        // One combined batch for both lists
        const moversTickers = [...topGainers, ...topLosers];
        const applyMovers = (moversData: ETF[]) => {
          const moversMap = new Map(moversData.map((item) => [item.ticker, item]));
          const gainersData = topGainers
            .map((ticker) => moversMap.get(ticker))
            .filter((item): item is ETF => !!item);
          const losersData = topLosers
            .map((ticker) => moversMap.get(ticker))
            .filter((item): item is ETF => !!item);

          setTrendingItems(
            gainersData.sort((a, b) => b.changePercent - a.changePercent),
          );
          setDiscountedItems(
            losersData.sort((a, b) => a.changePercent - b.changePercent),
          );
        };

        const moversData = await fetchSnapshot(moversTickers);
        if (cancelled) return;
        applyMovers(moversData);
        void fetchSnapshot(moversTickers, true)
          .then((details) => { if (!cancelled) applyMovers(details); })
          .catch((error) => console.warn("Mover chart history failed:", error));
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
      <div className="mb-6 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="text-xs font-semibold tracking-[0.2em] uppercase text-muted">
          Market Snapshot
        </span>
      </div>
      <div className="mb-14 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
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

        <div className="w-full h-full">
          {onImportPortfolio && <ImportPortfolioCard onImport={onImportPortfolio} className="h-full" />}
        </div>

      </div>

      {/* Stock Sections */}
      {loadingStocks ? (
        <>
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-ink">
              <Zap className="w-6 h-6 text-purple-400" />
              Large Tech Watchlist
            </h2>
            {renderSkeleton(4)}
          </div>
          <div className="mb-12">{renderSkeleton(4)}</div>
        </>
      ) : (
        <>
          <TrendingSection
            title="Large Tech Watchlist"
            items={mag7Items}
            Icon={Zap}
            theme="purple"
            onAddToPortfolio={onAddToPortfolio}
            portfolio={portfolio}
            onRemoveFromPortfolio={onRemoveFromPortfolio}
            onSelectItem={setSelectedItem}
            communityLookup={(ticker, assetType) => getRedditCommunities(ticker, assetType).map(c => ({ name: c.displayName, url: c.url }))}
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
            communityLookup={(ticker, assetType) => getRedditCommunities(ticker, assetType).map(c => ({ name: c.displayName, url: c.url }))}
          />
          <TrendingSection
            title="Reddit ETF Watchlist"
            items={justBuyItems}
            Icon={Sprout}
            theme="orange"
            onAddToPortfolio={onAddToPortfolio}
            portfolio={portfolio}
            onRemoveFromPortfolio={onRemoveFromPortfolio}
            onSelectItem={setSelectedItem}
            communityLookup={(ticker, assetType) => getRedditCommunities(ticker, assetType).map(c => ({ name: c.displayName, url: c.url }))}
          />
          <TrendingSection
            title="Top Daily Gainers"
            items={trendingItems}
            Icon={ShoppingBag}
            theme="emerald"
            onAddToPortfolio={onAddToPortfolio}
            portfolio={portfolio}
            onRemoveFromPortfolio={onRemoveFromPortfolio}
            onSelectItem={setSelectedItem}
            communityLookup={(ticker, assetType) => getRedditCommunities(ticker, assetType).map(c => ({ name: c.displayName, url: c.url }))}
          />
          <TrendingSection
            title="Top Daily Losers"
            items={discountedItems}
            Icon={TrendingDown}
            theme="rose"
            onAddToPortfolio={onAddToPortfolio}
            portfolio={portfolio}
            onRemoveFromPortfolio={onRemoveFromPortfolio}
            onSelectItem={setSelectedItem}
            communityLookup={(ticker, assetType) => getRedditCommunities(ticker, assetType).map(c => ({ name: c.displayName, url: c.url }))}
          />
        </>
      )}

      <ETFDetailsDrawer
        etf={selectedItem}
        onClose={() => setSelectedItem(null)}
        onTickerSelect={(ticker) => {
          const placeholder: ETF = {
            ticker,
            name: ticker,
            price: 0,
            changePercent: 0,
            assetType: "STOCK",
            history: [],
            metrics: {},
            allocation: { equities: 0, bonds: 0, cash: 0 },
          };
          setSelectedItem(placeholder);
        }}
      />
    </section>
  );
}
