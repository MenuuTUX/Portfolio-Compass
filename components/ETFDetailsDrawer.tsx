"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  TrendingUp,
  AlertTriangle,
  PieChart as PieIcon,
  Activity,
  ChevronLeft,
  Layers,
  Landmark,
  Info,
  Scale,
  ExternalLink,
  RefreshCw,
  LineChart,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ETF } from "@/types";
import { cn, formatCurrency, calculateRiskMetric } from "@/lib/utils";
import { calculateTTMYield } from "@/lib/finance";
import { getProviderLogo, getAssetIconUrl } from "@/lib/etf-providers";
import SectorPieChart, { COLORS } from "./SectorPieChart";
import AssetProfileCard from "./AssetProfileCard";
import EtfVerdictCard from "./EtfVerdictCard";
import ComparisonModal from "./ComparisonModal";
import { HelpTip } from "./ui/HelpTip";
import { useMemo, useState, useEffect } from "react";
import { getRedditCommunities } from "@/config/tickers";

interface ETFDetailsDrawerProps {
  etf: ETF | null;
  onClose: () => void;
  onTickerSelect?: (ticker: string) => void;
}

const TIME_RANGES = ["1D", "1W", "1M", "1Y", "5Y"];

// Helper to format sector names (snake_case -> Title Case)
const formatSectorName = (name: string) => {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

function formatLargeNumber(num: number | undefined): string {
  if (num === undefined) return "n/a";
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toLocaleString();
}

function formatNumber(num: number | undefined, decimals = 2): string {
  if (num === undefined) return "n/a";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Nullable variants: return null for missing values so sparse assets
// (e.g. microcaps with no scraped fundamentals) drop the card entirely
// instead of rendering a wall of "n/a".
function largeNumberOrNull(num: number | undefined | null): string | null {
  return num == null ? null : formatLargeNumber(num);
}

function numberOrNull(
  num: number | undefined | null,
  decimals = 2,
): string | null {
  return num == null ? null : formatNumber(num, decimals);
}

function volumeOrNull(num: number | undefined | null): string | null {
  if (num == null) return null;
  return num > 1e6 ? (num / 1e6).toFixed(1) + "M" : num.toLocaleString();
}

// Compact card for the Metrics grid — label is hoverable for beginners
function MetricCard({
  label,
  value,
  subValue,
  highlight,
}: {
  label: string;
  value: string;
  subValue?: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-surface-card rounded-xl p-3 border border-hairline hover:bg-surface-soft transition-colors group">
      <div className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider mb-1 group-hover:text-neutral-300 transition-colors">
        <HelpTip term={label} className="text-[10px] uppercase tracking-wider" />
      </div>
      <div
        className={cn(
          "text-sm font-bold truncate font-mono",
          highlight ? "text-emerald-400" : "text-ink",
        )}
      >
        {value}
      </div>
      {subValue && (
        <div className="text-[10px] text-neutral-500 mt-0.5">{subValue}</div>
      )}
    </div>
  );
}

interface MetricItem {
  label: string;
  value: string | null;
  subValue?: string;
  highlight?: boolean;
}

// Titled metrics grid that drops missing values; renders nothing when the
// whole section is empty so sparse assets get a compact, clean panel
function MetricSection({
  title,
  metrics,
}: {
  title: string;
  metrics: MetricItem[];
}) {
  const available = metrics.filter((m) => m.value !== null);
  if (available.length === 0) return null;
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider pl-1">
        {title}
      </h4>
      <div className="grid grid-cols-2 gap-3">
        {available.map((m) => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={m.value!}
            subValue={m.subValue}
            highlight={m.highlight}
          />
        ))}
      </div>
    </div>
  );
}

// Tickers that already ran a background deep-sync this session; avoids
// re-hitting the slow scrape pipeline every time a drawer re-opens
const deepSyncedThisSession = new Set<string>();

type FastPoint = { date: string; price: number };

// Merge fresh data into an asset without letting empty placeholder fields
// (empty arrays/objects, zeroed metrics) clobber real values we already have
function mergeAssetData(base: ETF, incoming: Partial<ETF>): ETF {
  const merged: any = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0
    )
      continue;
    merged[key] = value;
  }
  if (
    incoming.metrics &&
    !incoming.metrics.yield &&
    !incoming.metrics.mer &&
    (base.metrics?.yield || base.metrics?.mer)
  ) {
    merged.metrics = base.metrics;
  }
  if (
    incoming.allocation &&
    !incoming.allocation.equities &&
    !incoming.allocation.bonds &&
    !incoming.allocation.cash &&
    base.allocation
  ) {
    merged.allocation = base.allocation;
  }
  // Keep the longer history so the comparison modal has data to work with
  if (
    incoming.history &&
    base.history &&
    base.history.length > incoming.history.length
  ) {
    merged.history = base.history;
  }
  return merged as ETF;
}

export default function ETFDetailsDrawer({
  etf,
  onClose,
  onTickerSelect,
}: ETFDetailsDrawerProps) {
  const [timeRange, setTimeRange] = useState("1M");
  const [showComparison, setShowComparison] = useState(false);
  const [showFullComparison, setShowFullComparison] = useState(false);
  const [freshEtf, setFreshEtf] = useState<ETF | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [showAllHoldings, setShowAllHoldings] = useState(false);
  const [chartSeries, setChartSeries] = useState<{
    main: FastPoint[];
    spy: FastPoint[];
  }>({ main: [], spy: [] });
  const [chartNonce, setChartNonce] = useState(0);
  const [loadedChartKey, setLoadedChartKey] = useState("");
  const [prevEtf, setPrevEtf] = useState<ETF | null>(etf);

  // Use fresh data if available, otherwise fall back to prop
  const displayEtf = freshEtf || etf;

  // Reset state when the etf prop changes (adjust-during-render pattern,
  // avoids a cascading setState-in-effect)
  if (etf !== prevEtf) {
    setPrevEtf(etf);
    setFreshEtf(null);
    setShowLegend(false);
    setShowAllHoldings(false);
    setChartSeries({ main: [], spy: [] });
  }

  // Loading state is derived: the chart is loading until the fetch for the
  // current (ticker, range, comparison) key has settled
  const chartKey = etf
    ? `${etf.ticker.toUpperCase()}|${timeRange}|${showComparison}|${chartNonce}`
    : "";
  const isChartLoading = !!etf && loadedChartKey !== chartKey;

  // Chart data comes straight from the fast, DB-free market endpoint —
  // one round trip per (ticker, range), served from cache on repeats.
  useEffect(() => {
    if (!etf) return;
    let cancelled = false;
    const controller = new AbortController();
    const tickerKey = etf.ticker.toUpperCase();
    const tickers = showComparison ? `${tickerKey},SPY` : tickerKey;
    const key = `${tickerKey}|${timeRange}|${showComparison}|${chartNonce}`;

    fetch(
      `/api/market/chart?tickers=${encodeURIComponent(tickers)}&range=${timeRange}`,
      { signal: controller.signal },
    )
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(res.statusText)),
      )
      .then((data) => {
        if (cancelled) return;
        setChartSeries({
          main: data.series?.[tickerKey] || [],
          spy: data.series?.SPY || [],
        });
      })
      .catch((err) => {
        if (!cancelled && err?.name !== "AbortError") {
          console.error("Chart fetch failed:", err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadedChartKey(key);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [etf, timeRange, showComparison, chartNonce]);

  // Metrics: instant quote snapshot first, deep data (sectors, holdings,
  // fundamentals) hydrates quietly in the background without blocking the UI
  useEffect(() => {
    if (!etf) return;
    let cancelled = false;

    fetch(`/api/market/snapshot?tickers=${etf.ticker}&history=false`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        const snap = data.find(
          (item) => item.ticker === etf.ticker.toUpperCase(),
        );
        if (snap) setFreshEtf((prev) => mergeAssetData(prev || etf, snap));
      })
      .catch(() => {});

    // Fund technicals (expense ratio, sectors, holdings)
    // one Yahoo request, usually resolves in under a second
    fetch(`/api/market/etf-details?ticker=${etf.ticker}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((fund) => {
        if (cancelled || !fund) return;
        setFreshEtf((prev) => {
          const base = prev || etf;
          return mergeAssetData(base, {
            sectors: fund.sectors,
            holdings: fund.holdings.map((h: any) => ({
              ticker: h.ticker,
              name: h.name,
              weight: h.weight,
            })),
            holdingsCount: fund.holdingsCount,
            beta: fund.beta,
            metrics: {
              yield: base.metrics?.yield ?? 0,
              mer: fund.expenseRatio ?? base.metrics?.mer ?? 0,
            },
          });
        });
      })
      .catch(() => {});

    // Whatever the DB already knows (sectors, holdings from a past sync)
    fetch(`/api/etfs/search?query=${etf.ticker}&includeHoldings=true`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        const match = data.find((item) => item.ticker === etf.ticker);
        if (match) setFreshEtf((prev) => mergeAssetData(prev || etf, match));
      })
      .catch(() => {});

    // Background deep sync; merge when it lands
    if (!deepSyncedThisSession.has(etf.ticker)) {
      deepSyncedThisSession.add(etf.ticker);
      fetch("/api/etfs/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: etf.ticker }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((deep) => {
          if (cancelled || !deep?.ticker) return;
          setFreshEtf((prev) => mergeAssetData(prev || etf, deep));
        })
        .catch(() => {
          deepSyncedThisSession.delete(etf.ticker);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [etf]);

  const filteredEtfHistory = chartSeries.main;

  const historyData = useMemo(() => {
    if (filteredEtfHistory.length === 0) return [];

    if (showComparison && chartSeries.spy.length > 0) {
      const spyHistory = chartSeries.spy;

      // Both series share the same range/interval, so align by nearest
      // timestamp with a small tolerance
      const getSpyPriceAt = (targetDate: Date) => {
        const targetTime = targetDate.getTime();
        const tolerance =
          timeRange === "1D" || timeRange === "1W"
            ? 30 * 60 * 1000
            : 3 * 24 * 60 * 60 * 1000;

        let closest = spyHistory[0];
        let minDiff = Math.abs(new Date(closest.date).getTime() - targetTime);

        for (let i = 1; i < spyHistory.length; i++) {
          const current = spyHistory[i];
          const diff = Math.abs(new Date(current.date).getTime() - targetTime);
          if (diff < minDiff) {
            minDiff = diff;
            closest = current;
          }
        }

        return minDiff <= tolerance ? closest.price : null;
      };

      const etfStart = filteredEtfHistory[0].price;
      const spyStartPrice = getSpyPriceAt(new Date(filteredEtfHistory[0].date));
      const spyStart = spyStartPrice || spyHistory[0].price;

      let lastValidSpyPrice = spyStart;

      return filteredEtfHistory.map((h) => {
        let rawSpyPrice = getSpyPriceAt(new Date(h.date));

        // Forward fill: if missing data (e.g. at the end), use last known price
        if (rawSpyPrice !== null) {
          lastValidSpyPrice = rawSpyPrice;
        } else if (lastValidSpyPrice !== null) {
          rawSpyPrice = lastValidSpyPrice;
        }

        const spyPct = rawSpyPrice
          ? ((rawSpyPrice - spyStart) / spyStart) * 100
          : null;
        const etfPct = ((h.price - etfStart) / etfStart) * 100;

        return {
          date: h.date,
          price: etfPct,
          originalPrice: h.price,
          spyPrice: spyPct,
          originalSpyPrice: rawSpyPrice,
        };
      });
    }

    return filteredEtfHistory;
  }, [filteredEtfHistory, showComparison, chartSeries.spy, timeRange]);

  const { percentageChange, isPositive } = useMemo(() => {
    if (filteredEtfHistory.length < 2) {
      // No usable history for the selected range: fall back to the asset's
      // daily change instead of a misleading flat 0.00%
      const fallback = displayEtf?.changePercent ?? 0;
      return { percentageChange: fallback, isPositive: fallback >= 0 };
    }

    const startPrice = filteredEtfHistory[0].price;
    const endPrice = filteredEtfHistory[filteredEtfHistory.length - 1].price;
    const change = ((endPrice - startPrice) / startPrice) * 100;
    return { percentageChange: change, isPositive: change >= 0 };
  }, [filteredEtfHistory, displayEtf]);

  const riskData = useMemo(() => {
    if (!displayEtf) return null;
    return calculateRiskMetric(filteredEtfHistory);
  }, [displayEtf, filteredEtfHistory]);

  const sectorData = useMemo(() => {
    if (!displayEtf) return [];

    if (displayEtf.sectors && Object.keys(displayEtf.sectors).length > 0) {
      const raw = Object.entries(displayEtf.sectors).map(([name, value]) => ({
        name: formatSectorName(name),
        value,
      }));

      // Sectors are consistently stored as decimals (e.g. 0.15 for 15%) from Yahoo.
      // Even for leveraged ETFs where sum > 1.0 (e.g. 2.0), we should scale.
      return raw
        .map((item) => ({
          ...item,
          value: item.value * 100,
        }))
        .sort((a, b) => b.value - a.value);
    }

    if (displayEtf.holdings && displayEtf.holdings.length > 0) {
      const sampleSum = displayEtf.holdings.reduce(
        (acc, h) => acc + h.weight,
        0,
      );
      const isPercentage = sampleSum > 1.5;

      return displayEtf.holdings
        .slice(0, 10)
        .map((h) => ({
          name: h.name || h.ticker,
          value: isPercentage ? h.weight : h.weight * 100,
        }))
        .sort((a, b) => b.value - a.value);
    }

    return [];
  }, [displayEtf]);

  const allHoldings = useMemo(() => {
    if (!displayEtf?.holdings) return [];

    const sampleSum = displayEtf.holdings.reduce((acc, h) => acc + h.weight, 0);
    const isPercentage = sampleSum > 1.5;

    return [...displayEtf.holdings]
      .sort((a, b) => b.weight - a.weight)
      .map((h) => ({
        ...h,
        displayWeight: isPercentage ? h.weight : h.weight * 100,
      }));
  }, [displayEtf]);

  const topHoldings = useMemo(() => allHoldings.slice(0, 5), [allHoldings]);

  // Key Metrics computed up front so empty cards/sections collapse and a
  // fully-sparse asset (e.g. an unlisted microcap) shows a single notice
  // instead of a wall of "n/a"
  const metricSections = useMemo<{ title: string; metrics: MetricItem[] }[]>(() => {
    if (!displayEtf) return [];

    if (displayEtf.assetType === "STOCK") {
      return [
        {
          title: "Valuation",
          metrics: [
            {
              label: "Market Cap",
              value: largeNumberOrNull(displayEtf.marketCap),
            },
            { label: "PE Ratio", value: numberOrNull(displayEtf.peRatio) },
            { label: "Forward PE", value: numberOrNull(displayEtf.forwardPe) },
            { label: "EPS (ttm)", value: numberOrNull(displayEtf.eps) },
          ],
        },
        {
          title: "Dividends",
          metrics: [
            {
              label: "Div Yield",
              value: displayEtf.dividendYield
                ? `${displayEtf.dividendYield.toFixed(2)}%`
                : null,
              highlight: !!displayEtf.dividendYield,
            },
            {
              label: "Dividend",
              value: displayEtf.dividend
                ? formatCurrency(displayEtf.dividend)
                : null,
            },
            { label: "Ex-Div Date", value: displayEtf.exDividendDate || null },
            {
              label: "Earnings Date",
              value: displayEtf.earningsDate || null,
            },
          ],
        },
        {
          title: "Trading",
          metrics: [
            { label: "Beta", value: numberOrNull(displayEtf.beta) },
            { label: "Volume", value: volumeOrNull(displayEtf.volume) },
            {
              label: "52W High",
              value: numberOrNull(displayEtf.fiftyTwoWeekHigh),
            },
            {
              label: "52W Low",
              value: numberOrNull(displayEtf.fiftyTwoWeekLow),
            },
          ],
        },
        {
          title: "Financials",
          metrics: [
            { label: "Revenue", value: largeNumberOrNull(displayEtf.revenue) },
            {
              label: "Net Income",
              value: largeNumberOrNull(displayEtf.netIncome),
            },
            {
              label: "Shares Out",
              value: largeNumberOrNull(displayEtf.sharesOutstanding),
            },
          ],
        },
      ];
    }

    return [
      {
        title: "Overview",
        metrics: [
          { label: "Assets", value: largeNumberOrNull(displayEtf.marketCap) },
          {
            label: "Expense Ratio",
            value: displayEtf.metrics?.mer
              ? `${displayEtf.metrics.mer.toFixed(2)}%`
              : null,
          },
          { label: "PE Ratio", value: numberOrNull(displayEtf.peRatio) },
          {
            label: "Shares Out",
            value: largeNumberOrNull(displayEtf.sharesOutstanding),
          },
          { label: "Volume", value: volumeOrNull(displayEtf.volume) },
          {
            label: "Holdings",
            value: displayEtf.holdingsCount
              ? displayEtf.holdingsCount.toLocaleString()
              : displayEtf.holdings && displayEtf.holdings.length > 0
                ? displayEtf.holdings.length.toLocaleString()
                : null,
          },
          {
            label: "Inception Date",
            value: displayEtf.inceptionDate || null,
          },
          { label: "Beta", value: numberOrNull(displayEtf.beta) },
        ],
      },
      {
        title: "Dividends",
        metrics: [
          {
            label: "Dividend Yield",
            value: displayEtf.metrics?.yield
              ? `${displayEtf.metrics.yield.toFixed(2)}%`
              : null,
            highlight: !!displayEtf.metrics?.yield,
          },
          {
            label: "Dividend (ttm)",
            value: displayEtf.dividend
              ? formatCurrency(displayEtf.dividend)
              : null,
          },
          {
            label: "Ex-Dividend Date",
            value: displayEtf.exDividendDate || null,
          },
          {
            label: "Payout Frequency",
            value: displayEtf.payoutFrequency || null,
          },
          {
            label: "Payout Ratio",
            value: displayEtf.payoutRatio
              ? `${displayEtf.payoutRatio.toFixed(2)}%`
              : null,
          },
        ],
      },
      {
        title: "Trading",
        metrics: [
          { label: "Open", value: numberOrNull(displayEtf.open) },
          {
            label: "Previous Close",
            value: numberOrNull(displayEtf.previousClose),
          },
          { label: "Day's Range", value: displayEtf.daysRange || null },
          {
            label: "52-Week Low",
            value: numberOrNull(displayEtf.fiftyTwoWeekLow),
          },
          {
            label: "52-Week High",
            value: numberOrNull(displayEtf.fiftyTwoWeekHigh),
          },
        ],
      },
    ];
  }, [displayEtf]);

  const hasAnyMetric = metricSections.some((section) =>
    section.metrics.some((m) => m.value !== null),
  );

  return (
    <AnimatePresence>
      {displayEtf && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-dune/40 backdrop-blur-sm z-40"
          />
          <motion.div
            key="drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 h-[85vh] bg-canvas border-t border-hairline rounded-t-3xl z-50 overflow-hidden shadow-2xl glass-panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-hairline bg-surface-card backdrop-blur-md">
              <div className="flex items-center gap-4">
                {/* Provider Logo */}
                {getAssetIconUrl(
                  displayEtf.ticker,
                  displayEtf.name,
                  displayEtf.assetType,
                ) && (
                  <div className="w-12 h-12 flex items-center justify-center shrink-0">
                    <Image
                      src={
                        getAssetIconUrl(
                          displayEtf.ticker,
                          displayEtf.name,
                          displayEtf.assetType,
                        )!
                      }
                      alt={`${displayEtf.ticker} logo`}
                      width={48}
                      height={48}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.parentElement!.style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div>
                  <h2 className="text-3xl font-bold text-ink tracking-tight">
                    {displayEtf.ticker}
                  </h2>
                  <p className="text-neutral-400 text-sm">{displayEtf.name}</p>
                </div>
                <div className="h-8 w-[1px] bg-surface-soft mx-2" />
                <div>
                  <div className="text-2xl font-light text-ink">
                    {formatCurrency(displayEtf.price)}
                  </div>
                  <div
                    className={cn(
                      "text-xs font-medium",
                      isPositive ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {isPositive ? "+" : ""}
                    {percentageChange.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {riskData && riskData.label !== "Unknown" && (
                  <div
                    className={cn(
                      "hidden md:flex px-4 py-2 rounded-full border backdrop-blur-md items-center gap-2",
                      riskData.bgColor,
                      riskData.borderColor,
                    )}
                  >
                    <Activity className={cn("w-4 h-4", riskData.color)} />
                    <span className={cn("font-bold text-sm", riskData.color)}>
                      {riskData.label}
                    </span>
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="z-50 p-2 rounded-full bg-surface-soft hover:bg-surface-soft transition-colors text-ink border border-hairline shadow-lg"
                  aria-label="Close details"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 h-[calc(85vh-88px)] overflow-y-auto lg:overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                {/* Left Col: Chart */}
                <div className="lg:col-span-2 bg-surface-card rounded-2xl p-6 border border-hairline flex flex-col h-full min-h-[400px]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-lg font-bold text-ink">
                        Price History
                      </h3>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Full Comparison Button - Made More Prominent */}
                      <button
                        onClick={() => setShowFullComparison(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 transition-all text-sm font-bold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105 active:scale-95"
                      >
                        <Scale className="w-4 h-4" />
                        <span className="hidden sm:inline">Compare Assets</span>
                        <span className="sm:hidden">Compare</span>
                      </button>

                      {/* Comparison Toggle */}
                      <div className="flex items-center gap-2 bg-black/5 rounded-lg p-1 px-2">
                        <span
                          className={cn(
                            "text-xs font-medium transition-colors",
                            showComparison ? "text-ink" : "text-neutral-400",
                          )}
                        >
                          vs SPY
                        </span>
                        <button
                          onClick={() => setShowComparison(!showComparison)}
                          aria-label={
                            showComparison
                              ? "Disable SPY comparison"
                              : "Enable SPY comparison"
                          }
                          className={cn(
                            "w-8 h-4 rounded-full relative transition-colors duration-300 focus:outline-none",
                            showComparison
                              ? "bg-emerald-500"
                              : "bg-neutral-700",
                          )}
                        >
                          <div
                            className={cn(
                              "absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-300",
                              showComparison
                                ? "translate-x-4"
                                : "translate-x-0",
                            )}
                          />
                        </button>
                      </div>

                      <div className="flex bg-black/5 rounded-lg p-1 gap-1">
                        {TIME_RANGES.map((range) => (
                          <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={cn(
                              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                              timeRange === range
                                ? "bg-surface-soft text-ink"
                                : "text-neutral-400 hover:text-neutral-300",
                            )}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {historyData.length === 0 ? (
                    isChartLoading ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                        <p className="text-neutral-400 text-sm">
                          Loading chart…
                        </p>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 px-6">
                        <LineChart className="w-10 h-10 text-neutral-600" />
                        <p className="text-neutral-300 font-medium">
                          No price history available
                        </p>
                        <p className="text-neutral-500 text-sm max-w-sm">
                          We couldn&apos;t load chart data for this asset. It
                          may be thinly traded, recently listed, or the data
                          sync failed.
                        </p>
                        <button
                          onClick={() => setChartNonce((n) => n + 1)}
                          className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors text-sm font-medium"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Retry
                        </button>
                      </div>
                    )
                  ) : (
                    <div
                      className={cn(
                        "flex-1 w-full h-full min-h-0 transition-all duration-500",
                        isChartLoading
                          ? "blur-sm opacity-50"
                          : "blur-0 opacity-100",
                      )}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historyData}>
                        <defs>
                          <linearGradient
                            id="colorPriceUp"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#10b981"
                              stopOpacity={0.5}
                            />
                            <stop
                              offset="95%"
                              stopColor="#10b981"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="colorPriceDown"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#f43f5e"
                              stopOpacity={0.5}
                            />
                            <stop
                              offset="95%"
                              stopColor="#f43f5e"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="colorSpy"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#94a3b8"
                              stopOpacity={0.5}
                            />
                            <stop
                              offset="95%"
                              stopColor="#94a3b8"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(50,48,47,0.08)"
                          vertical={false}
                        />
                        <XAxis dataKey="date" hide />
                        <YAxis
                          domain={["auto", "auto"]}
                          orientation="right"
                          tick={{ fill: "#737373", fontSize: 12 }}
                          tickFormatter={(value) =>
                            showComparison
                              ? `${value.toFixed(2)}%`
                              : formatCurrency(value)
                          }
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--surface-card)",
                            border: "1px solid var(--hairline)",
                            borderRadius: "8px",
                            color: "var(--ink)",
                          }}
                          itemStyle={{ color: "var(--ink)" }}
                          formatter={(value: any, name: any, item: any) => {
                            // Ensure value is treated as a number safely
                            const numValue = Number(value);

                            if (showComparison) {
                              if (name === "spyPrice") {
                                return [
                                  `${!isNaN(numValue) ? numValue.toFixed(2) : "0.00"}%`,
                                  "SPY",
                                ];
                              }
                              return [
                                `${!isNaN(numValue) ? numValue.toFixed(2) : "0.00"}%`,
                                displayEtf.ticker,
                              ];
                            }
                            if (name === "spyPrice") {
                              const original = item.payload.originalSpyPrice;
                              return [
                                original ? formatCurrency(original) : "N/A",
                                "SPY",
                              ];
                            }
                            return [
                              formatCurrency(numValue),
                              displayEtf.ticker,
                            ];
                          }}
                          labelFormatter={(label) =>
                            new Date(label).toLocaleDateString() +
                            " " +
                            new Date(label).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="price"
                          stroke={isPositive ? "#10b981" : "#f43f5e"}
                          strokeWidth={2}
                          fillOpacity={1}
                          fill={`url(#${isPositive ? "colorPriceUp" : "colorPriceDown"})`}
                        />
                        {showComparison && (
                          <Area
                            type="monotone"
                            dataKey="spyPrice"
                            stroke="#94a3b8"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            strokeOpacity={0.7}
                            fillOpacity={0.1}
                            fill="url(#colorSpy)"
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                    <table className="sr-only">
                      <caption>Price History for {displayEtf.ticker}</caption>
                      <thead>
                        <tr>
                          <th scope="col">Date</th>
                          <th scope="col">Price</th>
                          {showComparison && <th scope="col">SPY Price</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.map((item: any, index) => (
                          <tr key={index}>
                            <td>{new Date(item.date).toLocaleDateString()}</td>
                            <td>
                              {showComparison
                                ? `${item.price.toFixed(2)}%`
                                : formatCurrency(item.price)}
                            </td>
                            {showComparison && (
                              <td>
                                {item.spyPrice
                                  ? `${item.spyPrice.toFixed(2)}%`
                                  : "N/A"}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  )}
                </div>

                {/* Right Col Wrapper */}
                <div className="lg:col-span-1 lg:h-full lg:overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                  <EtfVerdictCard etf={displayEtf} />

                  {/* Profile / Description Section */}
                  <div className="bg-surface-card rounded-2xl p-6 border border-hairline flex flex-col">
                    <AssetProfileCard
                      ticker={displayEtf.ticker}
                      assetType={
                        displayEtf.assetType === "STOCK" ? "STOCK" : "ETF"
                      }
                    />
                  </div>

                  {/* Reddit Communities Section */}
                  {(() => {
                    // Get communities from config/tickers.ts
                    const configCommunities = getRedditCommunities(displayEtf.ticker, displayEtf.assetType);
                    // Get communities from ETF data (if any)
                    const etfCommunities = displayEtf.redditCommunities || [];
                    
                    // Combine both sources, avoiding duplicates
                    const allCommunities = [
                      ...configCommunities.map(c => ({
                        name: c.displayName,
                        url: c.url,
                      })),
                      ...etfCommunities.map(c => ({
                        name: `r/${c.subreddit}`,
                        url: c.url,
                      })).filter(ec => !configCommunities.some(cc => cc.url === ec.url)),
                    ];

                    if (allCommunities.length === 0) return null;

                    return (
                      <div className="bg-gradient-to-br from-[#FF5700]/10 to-orange-900/10 rounded-2xl p-6 border border-[#FF5700]/20">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="p-2 rounded-lg bg-[#FF5700]/20">
                            <Activity className="w-5 h-5 text-[#FF5700]" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-ink">
                              Reddit Communities
                            </h3>
                            <p className="text-xs text-neutral-400">
                              Discuss {displayEtf.ticker} with investors
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {allCommunities.map((community, idx) => (
                            <a
                              key={idx}
                              href={community.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm bg-[#FF5700]/20 hover:bg-[#FF5700]/30 text-[#FF5700] px-4 py-2.5 rounded-xl border border-[#FF5700]/30 hover:border-[#FF5700]/50 transition-all duration-200 group hover:scale-105 active:scale-95 shadow-sm hover:shadow-[#FF5700]/20"
                            >
                              <span className="font-medium">{community.name}</span>
                              <ExternalLink className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sector & Holdings (ETFs Only) */}
                  {displayEtf.assetType !== "STOCK" && (
                    <div className="bg-surface-card rounded-2xl p-6 border border-hairline min-h-[200px] flex flex-col">
                      <div className="flex items-center gap-2 mb-4 justify-between">
                        <div
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setShowLegend(!showLegend)}
                        >
                          <PieIcon className="w-5 h-5 text-blue-400" />
                          <h3 className="text-lg font-bold text-ink">
                            Allocation
                          </h3>
                          <div
                            className={cn(
                              "text-xs bg-surface-soft px-2 py-0.5 rounded text-neutral-400 transition-colors",
                              showLegend && "bg-blue-500/20 text-blue-300",
                            )}
                          >
                            Legend
                          </div>
                        </div>
                      </div>

                      {showLegend && (
                        <div className="mb-4 grid grid-cols-2 gap-2 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
                          {sectorData.map((item, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2"
                            >
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    COLORS[index % COLORS.length],
                                }}
                              />
                              <span className="text-neutral-300 truncate">
                                {item.name}
                              </span>
                              <span className="text-neutral-500 ml-auto">
                                {item.value.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {showAllHoldings ? (
                        <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-hairline">
                            <button
                              onClick={() => setShowAllHoldings(false)}
                              className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              Back
                            </button>
                            <span className="text-sm font-medium text-ink ml-auto">
                              All Holdings ({allHoldings.length})
                            </span>
                          </div>

                          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[300px]">
                            {allHoldings.length > 0 ? (
                              <div className="space-y-1">
                                {allHoldings.map((h, i) => (
                                  <div
                                    key={i}
                                    className={cn(
                                      "flex items-center justify-between p-2 rounded-lg bg-surface-card border border-hairline hover:bg-surface-soft transition-all",
                                      onTickerSelect &&
                                        "cursor-pointer hover:border-emerald-500/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)] group/item",
                                    )}
                                    onClick={() =>
                                      onTickerSelect && onTickerSelect(h.ticker)
                                    }
                                  >
                                    <div className="flex items-center gap-3">
                                      {getAssetIconUrl(
                                        h.ticker,
                                        h.name || "",
                                        "ETF",
                                      ) && (
                                        <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                                          <Image
                                            src={
                                              getAssetIconUrl(
                                                h.ticker,
                                                h.name || "",
                                                "ETF",
                                              )!
                                            }
                                            alt={h.ticker}
                                            width={24}
                                            height={24}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                              e.currentTarget.style.display =
                                                "none";
                                              e.currentTarget.parentElement!.style.display =
                                                "none";
                                            }}
                                          />
                                        </div>
                                      )}
                                      <div
                                        className={cn(
                                          "font-bold text-ink text-sm",
                                          onTickerSelect &&
                                            "group-hover/item:text-emerald-400 transition-colors",
                                        )}
                                      >
                                        {h.ticker}
                                      </div>
                                      <div className="text-xs text-neutral-400 truncate max-w-[100px] hidden sm:block">
                                        {h.name}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="w-16 h-1.5 bg-surface-soft rounded-full overflow-hidden hidden sm:block">
                                        <div
                                          className="h-full bg-emerald-500 rounded-full"
                                          style={{
                                            width: `${Math.min(h.displayWeight * 2, 100)}%`,
                                          }}
                                        />
                                      </div>
                                      <div className="text-emerald-400 font-medium text-sm w-12 text-right">
                                        {h.displayWeight.toFixed(2)}%
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-40 text-neutral-500 text-sm text-center">
                                <Layers className="w-8 h-8 mb-2 opacity-50" />
                                <p>No holdings found.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-row h-[250px] gap-6">
                          {/* Left: Holdings List */}
                          <div className="w-1/2 flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                                Top Holdings
                              </div>
                              {allHoldings.length > 5 && (
                                <button
                                  onClick={() => setShowAllHoldings(true)}
                                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium hover:underline"
                                >
                                  See all {allHoldings.length}...
                                </button>
                              )}
                            </div>
                            <div className="flex-1 overflow-y-hidden space-y-2">
                              {topHoldings.map((h, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    "flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-surface-soft transition-colors group/row",
                                    onTickerSelect && "cursor-pointer",
                                  )}
                                  onClick={() =>
                                    onTickerSelect && onTickerSelect(h.ticker)
                                  }
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {getAssetIconUrl(
                                      h.ticker,
                                      h.name || "",
                                      "ETF",
                                    ) && (
                                      <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                                        <Image
                                          src={
                                            getAssetIconUrl(
                                              h.ticker,
                                              h.name || "",
                                              "ETF",
                                            )!
                                          }
                                          alt={h.ticker}
                                          width={20}
                                          height={20}
                                          className="w-full h-full object-contain"
                                          onError={(e) => {
                                            e.currentTarget.style.display =
                                              "none";
                                            e.currentTarget.parentElement!.style.display =
                                              "none";
                                          }}
                                        />
                                      </div>
                                    )}
                                    <div
                                      className={cn(
                                        "font-medium text-ink text-sm truncate",
                                        onTickerSelect &&
                                          "group-hover/row:text-emerald-400 transition-colors",
                                      )}
                                    >
                                      {h.ticker}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="w-12 h-1 bg-surface-soft rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-emerald-500 rounded-full opacity-80"
                                        style={{
                                          width: `${Math.min(h.displayWeight * 3, 100)}%`,
                                        }}
                                      />
                                    </div>
                                    <div className="text-emerald-400 text-xs w-8 text-right font-mono">
                                      {h.displayWeight.toFixed(1)}%
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {topHoldings.length === 0 && (
                                <div className="text-neutral-500 text-xs italic p-2">
                                  No holdings data available
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Pie Chart */}
                          <div className="w-1/2 relative bg-surface-card rounded-xl border border-hairline p-2 flex items-center justify-center">
                            <div className="absolute top-2 left-2 z-10">
                              <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-dune/30 px-1.5 py-0.5 rounded backdrop-blur-sm">
                                Sectors
                              </div>
                            </div>
                            <SectorPieChart
                              data={sectorData}
                              isLoading={false}
                              onSectorClick={(sector) => {
                                // Optional: Filter holdings by sector?
                                // For now just visual
                              }}
                            />
                            {sectorData.length === 0 && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-xs text-neutral-500 bg-dune/50 px-2 py-1 rounded">
                                  No Sector Data
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Metrics Grid */}
                  <div className="bg-surface-card rounded-2xl p-6 border border-hairline flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                        Key Metrics
                      </h3>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Hover any dotted label for a plain-English explanation.
                      </p>
                    </div>

                    {hasAnyMetric ? (
                      <div className="space-y-8">
                        {metricSections.map((section) => (
                          <MetricSection
                            key={section.title}
                            title={section.title}
                            metrics={section.metrics}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center gap-2 py-10">
                        <Info className="w-8 h-8 text-neutral-600" />
                        <p className="text-neutral-300 font-medium text-sm">
                          No detailed metrics available
                        </p>
                        <p className="text-neutral-500 text-xs max-w-[220px]">
                          We couldn&apos;t find fundamentals for this asset.
                          Thinly traded or delisted tickers often have limited
                          data.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <ComparisonModal
            baseAsset={displayEtf}
            isOpen={showFullComparison}
            onClose={() => setShowFullComparison(false)}
          />
        </>
      )}
    </AnimatePresence>
  );
}
