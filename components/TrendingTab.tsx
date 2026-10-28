"use client";

import { useState, useEffect, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ShoppingBag, TrendingDown, Zap, Sprout, Pickaxe, ChevronDown } from "lucide-react";
import { ETF, PortfolioItem } from "@/types";
import { ETFSchema } from "@/schemas/assetSchema";
import { z } from "zod";
import ETFDetailsDrawer from "./ETFDetailsDrawer";
import AssetWorkspace from "./workspace/AssetWorkspace";
import {
  LEFT_PANE,
  RIGHT_PANE,
  maxLeftPane,
  maxRightPane,
  PaneResizer,
  useResizableWidth,
} from "./workspace/PaneResizer";
import { useAssetChart } from "./workspace/useAssetChart";
import { mergeAssetData, useAssetDetails } from "./workspace/useAssetDetails";
import FearGreedGauge, { FEAR_GREED_GRADIENT } from "./FearGreedGauge";
import { RevealGroup, RevealItem, EASE } from "./motion/Reveal";
import TrendingSection from "./TrendingSection";
import PageHeader from "./home/PageHeader";
import SummaryCard from "./home/SummaryCard";
import { cn } from "@/lib/utils";
import { getAssetIconUrl } from "@/lib/etf-providers";
import Sparkline from "./Sparkline";
import SpHeatmap from "./SpHeatmap";
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
  onNavigate?: (tab: "TRENDING" | "PORTFOLIO" | "ETFS" | "STOCKS") => void;
}

const signed = (n: number, digits = 2) =>
  `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(n).toFixed(digits)}`;

const LG_QUERY = "(min-width: 1024px)";
function subscribeLg(callback: () => void) {
  const mq = window.matchMedia(LG_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}
function useIsLg() {
  return useSyncExternalStore(
    subscribeLg,
    () => window.matchMedia(LG_QUERY).matches,
    () => false,
  );
}

/** Left-panel group header that expands its content with an animated height. */
function PanelGroup({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `panel-group-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-label={title}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="mx-1 flex h-[42px] w-[calc(100%-0.5rem)] items-center gap-2 rounded-md px-2 text-left text-xs font-bold text-ink hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass"
      >
        <span className="flex-1 truncate">{title}</span>
        {trailing}
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      <motion.div
        id={panelId}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25, ease: EASE }}
        inert={!open}
        className="overflow-hidden"
      >
        <div className="px-3 pb-2">{children}</div>
      </motion.div>
    </section>
  );
}

const MoversResponseSchema = z.object({
  tickers: z.array(z.string()).catch([]),
});

function MoverCard({ title, item }: { title: string; item: ETF | null }) {
  return (
    <SummaryCard
      title={title}
      leading={
        item && (
          <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-surface-soft">
            <Image
              src={getAssetIconUrl(item.ticker, item.name, item.assetType) ?? `/api/logo/${encodeURIComponent(item.ticker)}`}
              alt={`${item.ticker} logo`}
              width={48}
              height={48}
              className="h-full w-full object-contain p-2"
            />
          </span>
        )
      }
      sub={
        item ? (
          <>
            <span className="block text-base font-bold text-ink">{item.ticker}</span>
            <span className="block truncate">{item.name}</span>
            <span
              className={cn(
                "mt-1 block text-sm font-semibold tabular-nums",
                item.changePercent >= 0 ? "text-compass" : "text-rose-400",
              )}
            >
              {signed(item.changePercent)}%
            </span>
          </>
        ) : (
          "Loading movers..."
        )
      }
      trailing={
        item?.history && item.history.length > 1 ? (
          <Sparkline
            data={item.history}
            color={item.changePercent >= 0 ? "var(--compass)" : "var(--loss)"}
            name={item.ticker}
          />
        ) : undefined
      }
    />
  );
}

export default function TrendingTab({
  onAddToPortfolio,
  portfolio = [],
  onRemoveFromPortfolio,
  onImportPortfolio,
  onNavigate,
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
  const [fearGreed, setFearGreed] = useState<{ score: number; rating: string } | null>(null);
  const [sideTab, setSideTab] = useState<"holdings" | "watchlist">("holdings");

  // lg+ workspace state
  const isLg = useIsLg();
  const left = useResizableWidth("left", LEFT_PANE.initial, LEFT_PANE.min, maxLeftPane);
  const right = useResizableWidth("right", RIGHT_PANE.initial, RIGHT_PANE.min, maxRightPane);
  const [selectedEtf, setSelectedEtf] = useState<ETF | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [fearOpen, setFearOpen] = useState(false);
  // Desktop opens on the S&P heatmap; picking an asset swaps the center to its chart
  const activeEtf = isLg ? selectedEtf : null;
  const selectedDisplay = useAssetDetails(activeEtf);
  const chart = useAssetChart(
    isLg ? (selectedDisplay?.ticker ?? null) : null,
    selectedDisplay?.changePercent ?? 0,
  );
  const handleSelect = (etf: ETF) => (isLg ? setSelectedEtf(etf) : setSelectedItem(etf));
  const handleTickerSelect = (ticker: string) => {
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
    handleSelect(placeholder);
  };
  const isInPortfolio = (ticker: string) =>
    portfolio.some((p) => p.ticker.toUpperCase() === ticker.toUpperCase());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market/fear-greed")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json && typeof json.score === "number") {
          setFearGreed({ score: json.score, rating: String(json.rating ?? "") });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const biggestMover = trendingItems[0] ?? null;
  const biggestLoser = discountedItems[0] ?? null;
  const sidePortfolio = portfolio.slice(0, 6);
  const sideWatch = mag7Items.slice(0, 6);
  const sideItems: { ticker: string; name: string; price: number; changePercent: number; shares?: number; assetType?: string }[] =
    sideTab === "holdings" && sidePortfolio.length > 0 ? sidePortfolio : sideWatch;

  const handleInstitutionalAdd = async (items: BatchAddItem[]) => {
    await batchAddMutation.mutateAsync({ items, replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    // Tickers currently shown, kept for the live refresh below
    const liveTickers = { curated: [] as string[], movers: [] as string[] };

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
      liveTickers.curated = allSpecificTickers;
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
        liveTickers.movers = moversTickers;
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

    // Keep prices live: re-pull quotes (no history) for everything on screen and
    // merge them into the existing rows so sparklines and details survive.
    const refreshQuotes = async () => {
      if (document.visibilityState !== "visible") return;
      const tickers = Array.from(
        new Set([...liveTickers.curated, ...liveTickers.movers]),
      );
      const batches: string[][] = [];
      for (let i = 0; i < tickers.length; i += 60) batches.push(tickers.slice(i, i + 60));
      try {
        const fresh = (await Promise.all(batches.map((b) => fetchSnapshot(b)))).flat();
        if (cancelled || fresh.length === 0) return;
        const byTicker = new Map(fresh.map((item) => [item.ticker, item]));
        const merge = (items: ETF[]) =>
          items.map((item) => {
            const next = byTicker.get(item.ticker);
            return next ? mergeAssetData(item, next) : item;
          });
        setMag7Items(merge);
        setJustBuyItems(merge);
        setNaturalResourcesItems(merge);
        setTrendingItems(merge);
        setDiscountedItems(merge);
      } catch (error) {
        console.warn("Live quote refresh failed:", error);
      }
    };
    const quoteTimer = window.setInterval(refreshQuotes, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(quoteTimer);
    };
  }, []);

  const communityLookup = (ticker: string, assetType?: string) =>
    getRedditCommunities(ticker, assetType).map((c) => ({
      name: c.displayName,
      url: c.url,
    }));

  const renderSkeleton = (label: string) => (
    <section className="mb-8" aria-label={label}>
      <h2 className="text-base font-semibold text-ink mb-3 px-1">{label}</h2>
      <div className="bg-surface-card ring-1 ring-hairline rounded-2xl divide-y divide-hairline">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 h-[60px]">
            <div className="w-10 h-10 rounded-xl bg-surface-soft" />
            <div className="space-y-1.5">
              <div className="h-3 w-16 rounded bg-surface-soft" />
              <div className="h-3 w-28 rounded bg-surface-soft" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const mobileView = (
    <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-6 min-h-full">
      <PageHeader>
        {onNavigate && (
          <>
            <button type="button" className="ws-pill" onClick={() => onNavigate("ETFS")}>
              Compare ETFs
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </button>
            <button type="button" className="ws-pill" onClick={() => onNavigate("PORTFOLIO")}>
              Open portfolio
            </button>
          </>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,924px)_393px] gap-x-20 gap-y-2 xl:justify-center mb-8">
        <div className="min-w-0">
          <SpHeatmap onSelectTicker={handleTickerSelect} />
          <p className="sr-only">Curated watchlists, daily movers and example allocations. Educational use only.</p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="ws-card flex items-center justify-center px-4 py-3 sm:row-span-2">
              <FearGreedGauge compact className="mx-auto max-w-[260px]" />
            </div>
            <MoverCard title="Biggest gainer today" item={biggestMover} />
            <MoverCard title="Biggest loser today" item={biggestLoser} />
          </div>
        </div>

        <aside className="min-w-0 mt-8 xl:mt-0" aria-label="Holdings and watchlist">
          <div className="ws-card overflow-hidden">
            <div className="flex items-center gap-1 px-4 pt-3" role="group" aria-label="Panel">
              {([
                ["holdings", "Holdings"],
                ["watchlist", "Watchlist"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={sideTab === key}
                  onClick={() => setSideTab(key)}
                  className={cn(
                    "rounded-lg px-2 py-1 min-h-8 text-sm font-bold transition-colors duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass",
                    sideTab === key ? "text-ink bg-surface-soft" : "text-muted hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <ul className="py-1">
              {sideItems.length === 0 ? (
                <li className="px-4 py-6 text-xs text-muted">
                  {sideTab === "holdings" ? "No holdings yet. Add assets to see them here." : "Loading watchlist..."}
                </li>
              ) : (
                sideItems.map((it) => (
                  <li key={it.ticker}>
                    <button
                      type="button"
                      className="ws-row w-full text-left"
                      onClick={() => {
                        const full = [...portfolio, ...mag7Items].find((x) => x.ticker === it.ticker);
                        if (full) setSelectedItem(full);
                      }}
                      aria-label={`Open details for ${it.ticker}`}
                    >
                      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-soft">
                        <Image
                          src={getAssetIconUrl(it.ticker, it.name, it.assetType ?? "STOCK") ?? `/api/logo/${encodeURIComponent(it.ticker)}`}
                          alt={`${it.ticker} logo`}
                          width={32}
                          height={32}
                          className="h-full w-full object-contain p-1.5"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-ink">{it.ticker}</span>
                        <span className="block truncate text-xs text-muted">{it.name}</span>
                      </span>
                      <span className="text-right tabular-nums">
                        <span className="block text-sm font-bold text-ink">{it.price > 0 ? it.price.toFixed(2) : "N/A"}</span>
                        <span className={cn("block text-xs", it.changePercent >= 0 ? "text-compass" : "text-rose-400")}>
                          {signed(it.changePercent)}%
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,924px)_393px] gap-x-20 gap-y-2 xl:justify-center">
        <div className="min-w-0">
          {loadingStocks ? (
            <>
              {renderSkeleton("Large Tech Watchlist")}
              {renderSkeleton("Natural Resources")}
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
            communityLookup={communityLookup}
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
            communityLookup={communityLookup}
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
            communityLookup={communityLookup}
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
            communityLookup={communityLookup}
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
            communityLookup={communityLookup}
          />
            </>
          )}
        </div>

        <aside className="min-w-0 space-y-8" aria-label="Market panels">
          <InstitutionalPortfolios
            onBatchAdd={handleInstitutionalAdd}
            isLoading={batchAddMutation.isPending}
          />
          {onImportPortfolio && <ImportPortfolioCard onImport={onImportPortfolio} />}
        </aside>
      </div>

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

  const CURATED_COUNT = mag7Items.length + naturalResourcesItems.length + justBuyItems.length;
  const watchlistProps = {
    Icon: Zap,
    onAddToPortfolio,
    portfolio,
    onRemoveFromPortfolio,
    onSelectItem: handleSelect,
    variant: "watchlist" as const,
    selectedTicker: activeEtf?.ticker ?? null,
  };

  const desktopView = (
    <section aria-label="Markets" className="h-full min-h-0">
      <RevealGroup
        onMount
        stagger={0.06}
        className={cn(
          "h-full min-h-0 grid",
          (left.dragging || right.dragging) && "select-none",
        )}
        style={{
          gridTemplateColumns: detailsOpen
            ? `${left.width}px 0.5rem minmax(0,1fr) 0.5rem ${right.width}px`
            : `${left.width}px 0.5rem minmax(0,1fr)`,
        }}
      >
        {/* Left: watchlists */}
        <RevealItem y={8} duration={0.5} className="ws-panel min-h-0 overflow-hidden flex flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between px-4 border-b border-hairline">
            <h2 className="text-sm font-bold text-ink">Markets</h2>
            <span className="text-xs text-muted tabular-nums">
              {mag7Items.length + naturalResourcesItems.length + justBuyItems.length || ""}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-2">
            <section aria-label="Fear and Greed">
              <button
                type="button"
                aria-expanded={fearOpen}
                aria-controls="fear-greed-panel"
                onClick={() => setFearOpen((o) => !o)}
                className="mx-1 mt-1 flex h-[42px] w-[calc(100%-0.5rem)] items-center gap-2 rounded-md px-2 text-left text-xs hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass"
              >
                <span className="font-bold text-ink">Fear &amp; Greed</span>
                <span className="min-w-0 flex-1 truncate text-muted capitalize">
                  {fearGreed ? `${Math.round(fearGreed.score)} ${fearGreed.rating}` : "Unavailable"}
                </span>
                {fearGreed && (
                  <span
                    className="relative h-1 w-10 shrink-0 rounded-full"
                    style={{ backgroundImage: `linear-gradient(to right, ${FEAR_GREED_GRADIENT.join(", ")})` }}
                    role="img"
                    aria-label={`Score ${Math.round(fearGreed.score)} of 100`}
                  >
                    <span
                      className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-1 ring-black/60"
                      style={{ left: `${Math.max(0, Math.min(100, fearGreed.score))}%` }}
                    />
                  </span>
                )}
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-muted transition-transform duration-200", fearOpen && "rotate-180")}
                  aria-hidden="true"
                />
              </button>
              <motion.div
                id="fear-greed-panel"
                initial={false}
                animate={{ height: fearOpen ? "auto" : 0, opacity: fearOpen ? 1 : 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                inert={!fearOpen}
                className="overflow-hidden"
              >
                {fearOpen && <FearGreedGauge compact className="mx-auto max-w-[240px]" />}
              </motion.div>
            </section>
            {loadingStocks ? (
              <div className="px-2 pt-3 space-y-1" aria-label="Loading watchlists" role="status">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 h-[42px] px-2 animate-pulse">
                    <div className="w-7 h-7 rounded-full bg-surface-soft" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-2.5 w-12 rounded bg-surface-soft" />
                      <div className="h-2.5 w-24 rounded bg-surface-soft" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <TrendingSection {...watchlistProps} title="Large Tech" items={mag7Items} startIndex={0} />
                <TrendingSection
                  {...watchlistProps}
                  Icon={Pickaxe}
                  title="Natural Resources"
                  items={naturalResourcesItems}
                  startIndex={mag7Items.length}
                />
                <TrendingSection
                  {...watchlistProps}
                  Icon={Sprout}
                  title="Reddit ETFs"
                  items={justBuyItems}
                  startIndex={mag7Items.length + naturalResourcesItems.length}
                />
                <TrendingSection
                  {...watchlistProps}
                  Icon={ShoppingBag}
                  title="Top gainers"
                  items={trendingItems.slice(0, 5)}
                  startIndex={CURATED_COUNT}
                />
                <TrendingSection
                  {...watchlistProps}
                  Icon={TrendingDown}
                  title="Top losers"
                  items={discountedItems.slice(0, 5)}
                  startIndex={CURATED_COUNT + 5}
                />
              </>
            )}
            <PanelGroup title="Allocation examples">
              <InstitutionalPortfolios
                compact
                onBatchAdd={handleInstitutionalAdd}
                isLoading={batchAddMutation.isPending}
              />
            </PanelGroup>
            <PanelGroup title="Import portfolio">
              {onImportPortfolio ? (
                <ImportPortfolioCard onImport={onImportPortfolio} className="bg-transparent ring-0 px-0" />
              ) : (
                <p className="text-xs text-muted">Portfolio import is not available here.</p>
              )}
            </PanelGroup>
          </div>
        </RevealItem>

        <PaneResizer
          label="Resize markets list"
          width={left.width}
          direction={1}
          onResize={left.setWidth}
          onCommit={left.persist}
          onDraggingChange={left.setDragging}
          onReset={left.reset}
        />

        {/* Center: asset workspace */}
        <RevealItem y={8} duration={0.5} className="ws-panel min-h-0 min-w-0 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0">
            {!selectedEtf ? (
              <div className="h-full p-6">
                <SpHeatmap fill onSelectTicker={handleTickerSelect} />
              </div>
            ) : (
            <AssetWorkspace
              etf={selectedDisplay}
              chart={chart}
              portfolio={portfolio}
              inPortfolio={selectedDisplay ? isInPortfolio(selectedDisplay.ticker) : false}
              onAdd={(etf) => {
                onAddToPortfolio(etf).catch((error) => console.error("Failed to add to portfolio", error));
              }}
              onRemove={(ticker) => onRemoveFromPortfolio?.(ticker)}
              detailsOpen={detailsOpen}
              onToggleDetails={() => setDetailsOpen((o) => !o)}
              onBack={() => setSelectedEtf(null)}
            />
            )}
          </div>
        </RevealItem>

        {/* Right: details, or sentiment before anything loads */}
        {detailsOpen && (
          <PaneResizer
            label="Resize details panel"
            width={right.width}
            direction={-1}
            onResize={right.setWidth}
            onCommit={right.persist}
            onDraggingChange={right.setDragging}
            onReset={right.reset}
          />
        )}
        {detailsOpen && (
          <RevealItem y={8} duration={0.5} className="ws-panel min-h-0 overflow-hidden">
            <ETFDetailsDrawer
              docked
              etf={selectedDisplay}
              chart={chart}
              onClose={() => setDetailsOpen(false)}
              onTickerSelect={handleTickerSelect}
            />
          </RevealItem>
        )}
      </RevealGroup>
    </section>
  );

  return isLg ? desktopView : mobileView;
}
