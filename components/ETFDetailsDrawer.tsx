"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Activity,
  ChevronLeft,
  ChevronRight,
  Layers,
  Info,
  Scale,
  ExternalLink,
  LineChart,
  ChevronDown,
} from "lucide-react";
import { ETF } from "@/types";
import { cn, formatCurrency, calculateRiskMetric, formatSectorName } from "@/lib/utils";
import { getAssetIconUrl } from "@/lib/etf-providers";
import SectorPieChart, { COLORS } from "./SectorPieChart";
import AssetProfileCard from "./AssetProfileCard";
import EtfVerdictCard from "./EtfVerdictCard";
import ComparisonModal from "./ComparisonModal";
import { HelpTip } from "./ui/HelpTip";
import { describeYieldProvenance, getSourcedYield } from "@/lib/yield-provenance";
import { describeExpenseRatioProvenance, getSourcedExpenseRatio } from "@/lib/fee-provenance";
import { quoteSessionLabel } from "@/lib/quote-session";
import { useId, useMemo, useState, type ReactNode } from "react";
import { getRedditCommunities } from "@/config/tickers";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { AssetChart, ChartRangeBar } from "./workspace/AssetChart";
import { useAssetChart, type AssetChartState } from "./workspace/useAssetChart";
import { useAssetDetails } from "./workspace/useAssetDetails";
import PriceTween from "./workspace/PriceTween";
import { RevealGroup, RevealItem } from "./motion/Reveal";

interface ETFDetailsDrawerProps {
  etf: ETF | null;
  onClose: () => void;
  onTickerSelect?: (ticker: string) => void;
  /** Render inline in a panel instead of as a modal bottom sheet. */
  docked?: boolean;
  /**
   * Chart state owned by the parent workspace. When set, the chart is not
   * drawn here (it lives in the center panel) and `etf` is used as-is.
   */
  chart?: AssetChartState;
}



// Helper to format sector names (snake_case -> Title Case)
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

function percentOrNA(num: number | null | undefined, source?: string | null): string {
  return num == null || (num === 0 && !source) ? "N/A" : `${num.toFixed(2)}%`;
}

function metricProvenance(source?: string | null, retrievedAt?: string | null): string | undefined {
  if (!source && !retrievedAt) return undefined;
  const date = retrievedAt ? new Date(retrievedAt).toLocaleDateString() : undefined;
  return [source, date ? `retrieved ${date}` : undefined].filter(Boolean).join(" · ");
}

// One label/value pair. Label (muted 12px) above value (12px).
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted leading-snug [&_.truncate]:whitespace-normal [&_.truncate]:overflow-visible [&_.truncate]:text-clip">
        <HelpTip term={label} className="text-xs" />
      </div>
      <div className="text-xs font-medium text-ink font-mono mt-1 break-words">
        {value}
      </div>
    </div>
  );
}

interface MetricItem {
  label: string;
  value: string | null;
  subValue?: string;
}

// Native-button accordion. Content stays mounted (so provenance notes remain
// in the DOM) and collapses with an animated grid-row transition.
function Accordion({
  title,
  defaultOpen = false,
  action,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  /** Optional control shown beside the title; only reachable while open. */
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section aria-label={title}>
      <h3 className="m-0 flex items-center">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-content`}
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-md text-left text-sm font-bold text-ink focus-visible:outline-2 focus-visible:outline-compass"
        >
          <span className="truncate">{title}</span>
          <ChevronDown
            className={cn("w-4 h-4 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </h3>
      <div
        id={`${id}-content`}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {action && <div className="flex justify-end pb-2">{action}</div>}
          <div className="pb-3 pt-1">{children}</div>
        </div>
      </div>
    </section>
  );
}

// Titled 3-column label/value grid that drops missing values; renders nothing
// when the whole section is empty so sparse assets get a compact panel
function MetricSection({
  title,
  metrics,
  defaultOpen = false,
}: {
  title: string;
  metrics: MetricItem[];
  defaultOpen?: boolean;
}) {
  const available = metrics.filter((m) => m.value !== null);
  if (available.length === 0) return null;
  const notes = available.filter((m) => m.subValue);
  return (
    <RevealItem>
      <Accordion title={title} defaultOpen={defaultOpen}>
        <div className="grid grid-cols-3 gap-x-3 gap-y-3">
          {available.map((m) => (
            <Fact key={m.label} label={m.label} value={m.value!} />
          ))}
        </div>
        {notes.length > 0 && (
          <ul className="mt-3 space-y-1">
            {notes.map((m) => (
              <li key={m.label} className="text-xs text-muted-soft leading-snug">
                {m.label}: {m.subValue}
              </li>
            ))}
          </ul>
        )}
      </Accordion>
    </RevealItem>
  );
}

// About text clamps to three lines until expanded
function ClampedAbout({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div
        className={cn(
          !expanded && "[&_p]:line-clamp-3 [&_button]:hidden",
        )}
      >
        {children}
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        className="mt-1 min-h-7 text-xs font-medium text-compass hover:underline focus-visible:outline-2 focus-visible:outline-compass rounded"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

function HoldingRow({
  holding,
  onSelect,
}: {
  holding: { ticker: string; name?: string; displayWeight: number };
  onSelect?: (ticker: string) => void;
}) {
  const icon = getAssetIconUrl(holding.ticker, holding.name || "", "ETF");
  const inner = (
    <>
      <span className="w-6 h-6 rounded-lg bg-surface-soft shrink-0 flex items-center justify-center overflow-hidden">
        {icon && (
          <Image
            src={icon}
            alt={`${holding.ticker} logo`}
            width={20}
            height={20}
            className="w-5 h-5 object-contain"
          />
        )}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-bold text-ink truncate">
          {holding.ticker}
        </span>
        {holding.name && (
          <span className="block text-xs text-muted truncate">{holding.name}</span>
        )}
      </span>
      <span className="text-xs font-medium text-ink font-mono shrink-0">
        {holding.displayWeight.toFixed(2)}%
      </span>
    </>
  );
  const cls = "flex items-center gap-3 w-full py-2 min-h-11";
  return onSelect ? (
    <button
      type="button"
      onClick={() => onSelect(holding.ticker)}
      className={cn(cls, "rounded-lg hover:bg-surface-soft transition-colors duration-75")}
    >
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}



export default function ETFDetailsDrawer({
  etf,
  onClose,
  onTickerSelect,
  docked = false,
  chart,
}: ETFDetailsDrawerProps) {
  const [showFullComparison, setShowFullComparison] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showAllHoldings, setShowAllHoldings] = useState(false);
  const [prevTicker, setPrevTicker] = useState(etf?.ticker);

  // With an external chart the parent already hydrated `etf` and owns the
  // chart state; otherwise this drawer fetches both itself.
  const external = chart !== undefined;
  const ownEtf = useAssetDetails(external ? null : etf);
  const displayEtf = external ? etf : ownEtf;
  const ownChart = useAssetChart(
    external ? null : (etf?.ticker ?? null),
    displayEtf?.changePercent ?? 0,
  );
  const c = chart ?? ownChart;
  const dialogRef = useDialogA11y<HTMLDivElement>(Boolean(displayEtf) && !docked, onClose);

  // Reset UI state when the asset changes (adjust-during-render pattern,
  // avoids a cascading setState-in-effect)
  if (etf?.ticker !== prevTicker) {
    setPrevTicker(etf?.ticker);
    setShowLegend(false);
    setShowAllHoldings(false);
  }


  const filteredEtfHistory = c.series;
  const { percentageChange, isPositive } = c;

  const riskData = useMemo(() => {
    if (!displayEtf) return null;
    return calculateRiskMetric(filteredEtfHistory);
  }, [displayEtf, filteredEtfHistory]);

  // Pie data: equity sectors → bond credit quality → top holdings weights
  const breakdownKind = useMemo<"sectors" | "credit" | "holdings" | "none">(
    () => {
      if (!displayEtf) return "none";
      if (displayEtf.sectors && Object.keys(displayEtf.sectors).length > 0) {
        return "sectors";
      }
      if (
        displayEtf.creditQuality &&
        Object.keys(displayEtf.creditQuality).length > 0
      ) {
        return "credit";
      }
      if (displayEtf.holdings && displayEtf.holdings.length > 0) {
        return "holdings";
      }
      return "none";
    },
    [displayEtf],
  );

  const sectorData = useMemo(() => {
    if (!displayEtf) return [];

    if (breakdownKind === "sectors" && displayEtf.sectors) {
      const raw = Object.entries(displayEtf.sectors).map(([name, value]) => ({
        name: formatSectorName(name),
        value,
      }));
      // Yahoo sectors are 0-1 fractions; scale to percent
      return raw
        .map((item) => ({
          ...item,
          value: item.value <= 1.5 ? item.value * 100 : item.value,
        }))
        .sort((a, b) => b.value - a.value);
    }

    if (breakdownKind === "credit" && displayEtf.creditQuality) {
      return Object.entries(displayEtf.creditQuality)
        .map(([name, value]) => ({
          name,
          value: value <= 1.5 ? value * 100 : value,
        }))
        .sort((a, b) => b.value - a.value);
    }

    if (breakdownKind === "holdings" && displayEtf.holdings) {
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
  }, [displayEtf, breakdownKind]);

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
      const sourcedYield = getSourcedYield(displayEtf.metrics, displayEtf.dividendYield);
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
              label: displayEtf.metrics?.yieldSource === "Yahoo Finance quote"
                ? "Yahoo yield unavailable · unverified"
                : "Div Yield",
              value: sourcedYield != null
                ? `${sourcedYield.toFixed(2)}%`
                : displayEtf.metrics?.yieldSource === "Yahoo Finance quote" ? "N/A" : null,
              subValue: describeYieldProvenance(displayEtf.metrics?.yieldSource, displayEtf.metrics?.yieldRetrievedAt, displayEtf.metrics?.yieldSourceField, displayEtf.metrics?.yieldInputUnit, displayEtf.metrics?.yieldNormalization, displayEtf.metrics?.yieldMeasurementDate),
            },
            {
              label: "Dividend",
              value: displayEtf.dividend
                ? formatCurrency(displayEtf.dividend, displayEtf.currency)
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

    const isBond =
      displayEtf.fundClass === "bond" ||
      (displayEtf.allocation?.bonds ?? 0) > 50;
    const sourcedYield = getSourcedYield(displayEtf.metrics, displayEtf.dividendYield);

    return [
      {
        title: "Overview",
        metrics: [
          { label: "Assets", value: largeNumberOrNull(displayEtf.marketCap) },
          {
            label: "Provider-reported expense ratio",
            value: percentOrNA(getSourcedExpenseRatio(displayEtf.metrics), displayEtf.metrics?.merSource),
            subValue: describeExpenseRatioProvenance(displayEtf.metrics),
          },
          // PE is equity-only noise for bond funds
          {
            label: "PE Ratio",
            value: isBond ? null : numberOrNull(displayEtf.peRatio),
          },
          {
            label: "Avg Maturity",
            value:
              displayEtf.bondMaturity != null
                ? `${displayEtf.bondMaturity.toFixed(1)} yrs`
                : null,
          },
          {
            label: "Duration",
            value:
              displayEtf.bondDuration != null
                ? `${displayEtf.bondDuration.toFixed(1)} yrs`
                : null,
          },
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
            label: displayEtf.metrics?.yieldSource === "Yahoo Finance quote"
              ? "Yahoo yield unavailable · unverified"
              : "Dividend Yield",
            value: percentOrNA(sourcedYield, displayEtf.metrics?.yieldSource),
            subValue: describeYieldProvenance(displayEtf.metrics?.yieldSource, displayEtf.metrics?.yieldRetrievedAt, displayEtf.metrics?.yieldSourceField, displayEtf.metrics?.yieldInputUnit, displayEtf.metrics?.yieldNormalization, displayEtf.metrics?.yieldMeasurementDate) ?? metricProvenance(displayEtf.metrics?.yieldSource, displayEtf.metrics?.yieldRetrievedAt),
          },
          {
            label: "Dividend (ttm)",
            value: displayEtf.dividend
              ? formatCurrency(displayEtf.dividend, displayEtf.currency)
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

  const logoUrl = getAssetIconUrl(
    displayEtf?.ticker ?? "",
    displayEtf?.name ?? "",
    displayEtf?.assetType,
  );
  const quoteLabel = displayEtf ? quoteSessionLabel(displayEtf.quoteSession) : null;
  const quoteTime =
    displayEtf?.quoteAsOf && Number.isFinite(Date.parse(displayEtf.quoteAsOf))
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(displayEtf.quoteAsOf))
      : null;

  const extHeader = displayEtf && external ? (
    <div className="flex items-center gap-2 px-4 py-2 shrink-0">
      <p className="min-w-0 flex-1 text-xs text-muted truncate" title={displayEtf.name}>
        <span id="etf-details-title" className="font-bold text-ink">
          {displayEtf.ticker}
        </span>{" "}
        {displayEtf.name}
      </p>
      {riskData && riskData.label !== "Unknown" && (
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-surface-soft px-2.5 py-1 text-xs font-medium text-body-strong">
          <Activity className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
          {riskData.label}
        </div>
      )}
      <button
        type="button"
        onClick={onClose}
        className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-muted hover:bg-surface-soft hover:text-ink transition-colors duration-75 focus-visible:outline-2 focus-visible:outline-compass"
        aria-label="Collapse details"
      >
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  ) : null;

  const stdHeader = displayEtf && !external ? (
    <div className="flex items-center gap-3 px-5 py-4 shrink-0">
      <div className="w-10 h-10 rounded-lg bg-surface-soft flex items-center justify-center shrink-0 overflow-hidden">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={`${displayEtf.ticker} logo`}
            width={24}
            height={24}
            className="w-6 h-6 object-contain"
          />
        ) : (
          <span className="text-sm font-bold text-ink">
            {displayEtf.ticker.slice(0, 1)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h2
          id="etf-details-title"
          className="text-base font-semibold text-ink leading-tight truncate"
        >
          {displayEtf.ticker}
        </h2>
        <p className="text-xs text-muted truncate" title={displayEtf.name}>
          {displayEtf.name}
        </p>
      </div>
      {riskData && riskData.label !== "Unknown" && (
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-surface-soft px-3 py-1 text-xs font-medium text-body-strong">
          <Activity className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
          {riskData.label}
        </div>
      )}
      <button
        type="button"
        onClick={onClose}
        className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-body-strong hover:bg-surface-soft transition-colors duration-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass"
        aria-label={docked ? "Collapse details" : "Close details"}
      >
        {docked ? (
          <ChevronRight className="w-5 h-5" />
        ) : (
          <X className="w-5 h-5" />
        )}
      </button>
    </div>
  ) : null;

  const header = extHeader ?? stdHeader;

  const aboutCard = displayEtf ? (
    <AssetProfileCard
      ticker={displayEtf.ticker}
      assetType={displayEtf.assetType === "STOCK" ? "STOCK" : "ETF"}
    />
  ) : null;

  const content = displayEtf ? (
    <div className="px-4 pb-6 space-y-4">
      {/* Price */}
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[32px] leading-[38px] font-bold text-ink font-mono">
            <PriceTween
              value={displayEtf.price}
              format={(v) => formatCurrency(v, displayEtf.currency)}
            />
          </span>
          <span className="text-xs text-muted">
            {displayEtf.currency || "USD"}
          </span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${displayEtf.ticker}|${c.range}|${percentageChange.toFixed(2)}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-1 flex items-center gap-2 text-xs"
          >
            <span
              className={cn(
                "font-medium font-mono",
                isPositive ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {c.absoluteChange != null &&
                `${c.absoluteChange >= 0 ? "+" : "-"}${Math.abs(c.absoluteChange).toFixed(2)} (`}
              {isPositive ? "+" : ""}
              {percentageChange.toFixed(2)}%
              {c.absoluteChange != null && ")"}
            </span>
            <span className="text-muted">
              {c.range === "MAX" ? "all time" : `past ${c.range}`}
            </span>
          </motion.div>
        </AnimatePresence>
        {(quoteLabel || quoteTime) && (
          <div className="mt-1 text-xs text-muted">
            {quoteLabel}
            {quoteLabel && quoteTime ? " · " : ""}
            {quoteTime}
          </div>
        )}
      </div>

      <RevealGroup key={displayEtf.ticker} onMount stagger={0.04} className="space-y-1">
      {/* Chart (bottom sheet only; the docked workspace plots it in the center panel) */}
      {!external && (
        <div>
          <div className="h-48 w-full">
            <AssetChart chart={c} ticker={displayEtf.ticker} currency={displayEtf.currency} />
          </div>

          <ChartRangeBar chart={c} className="mt-3 justify-between" />

        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={c.compare}
            aria-label={
              c.compare ? "Disable SPY comparison" : "Enable SPY comparison"
            }
            onClick={() => c.setCompare(!c.compare)}
            className="inline-flex items-center gap-2 min-h-11 lg:min-h-9 text-xs font-medium text-body-strong focus-visible:outline-2 focus-visible:outline-compass rounded-lg"
          >
            <span
              className={cn(
                "relative w-8 h-5 rounded-full transition-colors duration-75",
                c.compare ? "bg-ink" : "bg-surface-soft ring-1 ring-hairline-strong",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform duration-75",
                  c.compare
                    ? "translate-x-3 bg-canvas"
                    : "translate-x-0 bg-muted",
                )}
              />
            </span>
            vs SPY
          </button>
          <button
            type="button"
            onClick={() => setShowFullComparison(true)}
            className="inline-flex items-center gap-2 rounded-full bg-surface-soft hover:bg-hairline-strong transition-colors duration-75 px-4 min-h-11 lg:min-h-9 text-xs font-semibold text-ink focus-visible:outline-2 focus-visible:outline-compass"
          >
            <Scale className="w-3.5 h-3.5" aria-hidden="true" />
            Compare assets
          </button>
        </div>
        </div>
      )}

      {!external && <EtfVerdictCard etf={displayEtf} history={filteredEtfHistory} />}

      {!external && aboutCard && <ClampedAbout>{aboutCard}</ClampedAbout>}

      {/* Key metrics */}
      {hasAnyMetric ? (
        <div className="space-y-1">
          {metricSections
            .filter((section) => section.metrics.some((m) => m.value !== null))
            .map((section, i) => (
              <MetricSection
                key={section.title}
                title={section.title}
                metrics={section.metrics}
                defaultOpen={i < 2}
              />
            ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center gap-2 py-6">
          <Info className="w-6 h-6 text-muted-soft" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">
            No detailed metrics available
          </p>
          <p className="text-xs text-muted max-w-[240px]">
            We couldn&apos;t find fundamentals for this asset. Thinly traded or
            delisted tickers often have limited data.
          </p>
        </div>
      )}

      {external && aboutCard && <RevealItem><ClampedAbout>{aboutCard}</ClampedAbout></RevealItem>}

      {/* Allocation (ETFs only) */}
      {displayEtf.assetType !== "STOCK" && (
        <RevealItem>
        <Accordion
          title="Allocation"
          action={
            <button
              type="button"
              onClick={() => setShowLegend(!showLegend)}
              aria-expanded={showLegend}
              className={cn(
                "rounded-full px-3 min-h-7 text-xs font-medium transition-colors duration-75",
                showLegend
                  ? "bg-surface-soft text-ink"
                  : "text-muted hover:bg-surface-soft hover:text-ink",
              )}
            >
              Legend
            </button>
          }
        >
        <div className="space-y-3">

          {showLegend && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {sectorData.map((item, index) => (
                <div key={index} className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-body-strong truncate">{item.name}</span>
                  <span className="text-muted ml-auto font-mono">
                    {item.value.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {showAllHoldings ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setShowAllHoldings(false)}
                  className="inline-flex items-center gap-1 min-h-8 text-xs font-medium text-compass hover:underline"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Back
                </button>
                <span className="text-xs text-muted">
                  All holdings ({allHoldings.length})
                </span>
              </div>
              <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                {allHoldings.length > 0 ? (
                  allHoldings.map((h, i) => (
                    <HoldingRow
                      key={i}
                      holding={h}
                      onSelect={onTickerSelect}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-muted text-xs text-center">
                    <Layers className="w-6 h-6 mb-2" aria-hidden="true" />
                    <p>No holdings found.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="relative h-48 rounded-lg bg-surface-soft p-2 flex items-center justify-center">
                <div className="absolute top-2 left-3 z-10 text-xs font-medium text-muted">
                  {breakdownKind === "credit"
                    ? "Credit"
                    : breakdownKind === "holdings"
                      ? "Weights"
                      : "Sectors"}
                </div>
                <SectorPieChart
                  data={sectorData}
                  isLoading={false}
                  onSectorClick={() => {}}
                />
                {sectorData.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-3">
                    <span className="text-xs text-muted text-center leading-snug">
                      {displayEtf.fundClass === "bond"
                        ? "No credit-quality breakdown"
                        : displayEtf.fundClass === "leveraged"
                          ? "No sector map for this product"
                          : "No sector data"}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-medium text-muted">
                    {displayEtf.fundClass === "bond"
                      ? "Bond profile"
                      : "Top holdings"}
                  </h4>
                  {allHoldings.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllHoldings(true)}
                      className="min-h-8 text-xs font-medium text-compass hover:underline"
                    >
                      See all {allHoldings.length}
                    </button>
                  )}
                </div>

                {topHoldings.length === 0 &&
                  (displayEtf.fundClass === "bond" ||
                    displayEtf.bondMaturity ||
                    displayEtf.bondDuration) && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-x-4 gap-y-4">
                        {displayEtf.bondMaturity != null && (
                          <Fact
                            label="Avg maturity"
                            value={`${displayEtf.bondMaturity.toFixed(1)} yrs`}
                          />
                        )}
                        {displayEtf.bondDuration != null && (
                          <Fact
                            label="Duration"
                            value={`${displayEtf.bondDuration.toFixed(1)} yrs`}
                          />
                        )}
                        {displayEtf.allocation &&
                          displayEtf.allocation.bonds > 0 && (
                            <Fact
                              label="Bonds"
                              value={`${displayEtf.allocation.bonds.toFixed(1)}%`}
                            />
                          )}
                        {displayEtf.allocation &&
                          displayEtf.allocation.cash > 0 && (
                            <Fact
                              label="Cash"
                              value={`${displayEtf.allocation.cash.toFixed(1)}%`}
                            />
                          )}
                      </div>
                      {displayEtf.category && (
                        <p className="text-xs text-muted">
                          {displayEtf.category}
                          {displayEtf.family ? ` · ${displayEtf.family}` : ""}
                        </p>
                      )}
                    </div>
                  )}
                {topHoldings.length === 0 &&
                  displayEtf.fundClass === "leveraged" && (
                    <p className="text-xs text-muted leading-relaxed">
                      Leveraged / futures-based products often hold cash
                      collateral rather than a stock basket. Exposure is via
                      swaps or futures, so no traditional holdings list is
                      published.
                    </p>
                  )}
                {topHoldings.length === 0 &&
                  !displayEtf.bondMaturity &&
                  !displayEtf.bondDuration &&
                  displayEtf.fundClass !== "leveraged" &&
                  displayEtf.fundClass !== "bond" && (
                    <p className="text-xs text-muted">
                      No holdings data available
                    </p>
                  )}
                {topHoldings.map((h, i) => (
                  <HoldingRow key={i} holding={h} onSelect={onTickerSelect} />
                ))}
              </div>
            </>
          )}
        </div>
        </Accordion>
        </RevealItem>
      )}

      {/* Communities */}
      {(() => {
        const configCommunities = getRedditCommunities(
          displayEtf.ticker,
          displayEtf.assetType,
        );
        const etfCommunities = displayEtf.redditCommunities || [];
        const allCommunities = [
          ...configCommunities.map((c) => ({ name: c.displayName, url: c.url })),
          ...etfCommunities
            .map((c) => ({ name: `r/${c.subreddit}`, url: c.url }))
            .filter((ec) => !configCommunities.some((cc) => cc.url === ec.url)),
        ];
        if (allCommunities.length === 0) return null;
        return (
          <RevealItem>
          <Accordion title="Communities">
            <p className="text-xs text-muted mb-2">
              Discuss {displayEtf.ticker} with investors
            </p>
            <div className="flex flex-wrap gap-2">
              {allCommunities.map((community, idx) => (
                <a
                  key={idx}
                  href={community.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-soft hover:bg-hairline-strong transition-colors duration-75 px-3 min-h-7 text-xs font-medium text-body-strong"
                >
                  {community.name}
                  <ExternalLink className="w-3 h-3 text-muted" aria-hidden="true" />
                </a>
              ))}
            </div>
          </Accordion>
          </RevealItem>
        );
      })()}
      </RevealGroup>
    </div>
  ) : null;

  const comparison = displayEtf && !external ? (
    <ComparisonModal
      baseAsset={displayEtf}
      isOpen={showFullComparison}
      onClose={() => setShowFullComparison(false)}
    />
  ) : null;

  if (docked) {
    return (
      <>
        <div className="h-full min-h-0 flex flex-col">
          {displayEtf ? (
            <>
              {header}
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {content}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8 text-center">
              <LineChart className="w-6 h-6 text-muted-soft" aria-hidden="true" />
              <p className="text-sm text-muted">Select an asset to see details</p>
            </div>
          )}
        </div>
        {comparison}
      </>
    );
  }

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
            className="fixed inset-0 bg-black/50 z-40"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="etf-details-title"
            key="drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 h-[85dvh] bg-surface-card ring-1 ring-hairline rounded-t-2xl z-50 overflow-hidden shadow-2xl flex flex-col"
          >
            {header}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              <div className="max-w-2xl mx-auto w-full">{content}</div>
            </div>
          </motion.div>
          {comparison}
        </>
      )}
    </AnimatePresence>
  );
}
