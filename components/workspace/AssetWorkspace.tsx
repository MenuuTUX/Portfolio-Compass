"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChartArea,
  ChartCandlestick,
  LayoutGrid,
  ChevronDown,
  LineChart as LineChartIcon,
  PanelRight,
  Star,
  X,
} from "lucide-react";
import { ETF, PortfolioItem } from "@/types";
import { cn, formatCurrency } from "@/lib/utils";
import { getAssetIconUrl } from "@/lib/etf-providers";
import EtfVerdictCard from "../EtfVerdictCard";
import AssetProfileCard from "../AssetProfileCard";
import ComparisonModal from "../ComparisonModal";
import { AssetChart, ChartRangeBar } from "./AssetChart";
import type { AssetChartState } from "./useAssetChart";
import HoldingIcon from "./HoldingIcon";
import PriceTween from "./PriceTween";
import { EASE } from "../motion/Reveal";

const MIN_DRAWER = 36;
const DEFAULT_DRAWER = 160;
const DRAWER_STEP = 24;

interface AssetWorkspaceProps {
  etf: ETF | null;
  chart: AssetChartState;
  portfolio: PortfolioItem[];
  inPortfolio: boolean;
  onAdd: (etf: ETF) => void;
  onRemove: (ticker: string) => void;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  /** Returns to the market overview (heatmap) when provided. */
  onBack?: () => void;
}

type DrawerTab = "portfolio" | "verdict" | "profile";
const DRAWER_TABS: { id: DrawerTab; label: string }[] = [
  { id: "portfolio", label: "Portfolio" },
  { id: "verdict", label: "Verdict" },
  { id: "profile", label: "Profile" },
];

const pill =
  "inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-full bg-surface-soft hover:bg-hairline-strong text-xs font-semibold text-ink transition-colors duration-75 focus-visible:outline-2 focus-visible:outline-compass";

function Stat({ label, value, title }: { label: string; value: string; title: string }) {
  return (
    <span className="text-xs text-muted whitespace-nowrap" title={title}>
      {label} <span className="font-mono text-body-strong">{value}</span>
    </span>
  );
}

function parseRange(range?: string): { low: string; high: string } | null {
  if (!range) return null;
  const parts = range.split(/\s*[-–—]\s*/).filter(Boolean);
  return parts.length === 2 ? { low: parts[0], high: parts[1] } : null;
}

export default function AssetWorkspace({
  etf,
  chart,
  portfolio,
  inPortfolio,
  onAdd,
  onRemove,
  detailsOpen,
  onToggleDetails,
  onBack,
}: AssetWorkspaceProps) {
  const [kind, setKind] = useState<"area" | "candles">("area");
  const [showCompare, setShowCompare] = useState(false);
  const [drawerH, setDrawerH] = useState(MIN_DRAWER);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<DrawerTab>("portfolio");
  const drawerId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const lastOpenH = useRef(DEFAULT_DRAWER);
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);

  const drawerOpen = drawerH > MIN_DRAWER;
  // Drawer may take at most 60% of the center panel
  const applyHeight = (h: number) => {
    const max = Math.max(
      MIN_DRAWER + DRAWER_STEP,
      Math.round((rootRef.current?.clientHeight ?? 600) * 0.6),
    );
    const next = Math.min(max, Math.max(MIN_DRAWER, Math.round(h)));
    if (next > MIN_DRAWER) lastOpenH.current = next;
    setDrawerH(next);
  };
  const toggleDrawer = () =>
    drawerOpen ? setDrawerH(MIN_DRAWER) : applyHeight(lastOpenH.current);

  if (!etf) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8 text-center">
        <LineChartIcon className="w-6 h-6 text-muted-soft" aria-hidden="true" />
        <p className="text-sm text-muted">Select an asset to see its chart</p>
      </div>
    );
  }

  const logoUrl = getAssetIconUrl(etf.ticker, etf.name, etf.assetType);
  const rangeLabel = chart.range === "MAX" ? "all time" : `past ${chart.range}`;
  const ohl = parseRange(etf.daysRange);
  const toggleHolding = () => (inPortfolio ? onRemove(etf.ticker) : onAdd(etf));
  const holdingLabel = inPortfolio
    ? `Remove ${etf.ticker} from portfolio`
    : `Add ${etf.ticker} to portfolio`;

  return (
    <>
      <div ref={rootRef} className="flex flex-col h-full min-h-0">
        {/* Instrument header */}
        <div className="flex flex-nowrap items-center gap-x-3 px-4 pt-2 pb-1.5 shrink-0 min-w-0 overflow-hidden">
          <span className="w-6 h-6 rounded-full bg-surface-soft flex items-center justify-center shrink-0 overflow-hidden">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={`${etf.ticker} logo`}
                width={16}
                height={16}
                className="w-4 h-4 object-contain"
              />
            ) : (
              <span className="text-xs font-bold text-ink">{etf.ticker.slice(0, 1)}</span>
            )}
          </span>
          <h2 className="text-xs font-bold text-ink shrink-0">{etf.ticker}</h2>
          <span
            className="hidden lg:block text-xs text-muted truncate max-w-[180px] min-w-0"
            title={etf.name}
          >
            {etf.name}
          </span>
          <button
            type="button"
            onClick={toggleHolding}
            aria-pressed={inPortfolio}
            aria-label={holdingLabel}
            title={holdingLabel}
            className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center hover:bg-surface-soft transition-colors duration-75 focus-visible:outline-2 focus-visible:outline-compass",
              inPortfolio ? "text-emerald-400" : "text-muted hover:text-ink",
            )}
          >
            <Star
              className="w-4 h-4"
              fill={inPortfolio ? "currentColor" : "none"}
              aria-hidden="true"
            />
          </button>
          <span className="text-xs font-bold text-ink font-mono shrink-0">
            {etf.quoteStatus === "unavailable" ? (
              "N/A"
            ) : (
              <PriceTween
                value={etf.price}
                format={(v) => formatCurrency(v, etf.currency)}
              />
            )}
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={`${etf.ticker}|${chart.range}|${chart.percentageChange.toFixed(2)}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "text-xs font-medium font-mono whitespace-nowrap shrink-0",
                chart.isPositive ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {chart.isPositive ? "+" : ""}
              {chart.percentageChange.toFixed(2)}%{" "}
              <span className="text-muted font-normal">{rangeLabel}</span>
            </motion.span>
          </AnimatePresence>
          <span className="hidden 2xl:flex items-center gap-3">
            {etf.open != null && (
              <Stat label="O" value={etf.open.toFixed(2)} title="Open" />
            )}
            {ohl && <Stat label="H" value={ohl.high} title="Day high" />}
            {ohl && <Stat label="L" value={ohl.low} title="Day low" />}
            {etf.previousClose != null && (
              <Stat label="C" value={etf.previousClose.toFixed(2)} title="Previous close" />
            )}
          </span>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="View"
              className="flex items-center rounded-full bg-surface-soft p-0.5"
            >
              <button
                type="button"
                aria-pressed="true"
                className="h-6 px-3 rounded-full bg-hairline-strong text-xs font-semibold text-ink"
              >
                Chart
              </button>
              <button
                type="button"
                onClick={() => setShowCompare(true)}
                className="h-6 px-3 rounded-full text-xs font-medium text-muted hover:text-ink transition-colors duration-75 focus-visible:outline-2 focus-visible:outline-compass"
              >
                Compare
              </button>
            </div>
            {!detailsOpen && (
              <button
                type="button"
                onClick={onToggleDetails}
                aria-label="Show details"
                title="Show details"
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:bg-surface-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-compass"
              >
                <PanelRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-nowrap items-center gap-2 px-4 pb-1.5 shrink-0">
          {onBack && (
            <button type="button" onClick={onBack} className={pill}>
              <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
              Heatmap
            </button>
          )}
          <button
            type="button"
            onClick={toggleHolding}
            className={cn(pill, "relative")}
          >
            <span className="relative flex items-center justify-center">
              <HoldingIcon inPortfolio={inPortfolio} className="w-3.5 h-3.5" />
            </span>
            {inPortfolio ? "Remove" : "Add to portfolio"}
          </button>
          <button
            type="button"
            aria-pressed={chart.compare}
            onClick={() => chart.setCompare(!chart.compare)}
            className={cn(
              pill,
              chart.compare && "ring-1 ring-hairline-strong bg-hairline-strong",
            )}
          >
            vs SPY
          </button>
          <div
            role="group"
            aria-label="Chart style"
            className="ml-auto flex items-center gap-1"
          >
            {(
              [
                ["area", "Area chart", ChartArea],
                ["candles", "Candlestick chart", ChartCandlestick],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                aria-label={label}
                title={label}
                onClick={() => {
                  setKind(k);
                  chart.setWantCandles(k === "candles");
                }}
                className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-75 focus-visible:outline-2 focus-visible:outline-compass",
                  kind === k
                    ? "bg-surface-soft text-ink"
                    : "text-muted hover:bg-surface-soft hover:text-ink",
                )}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        {/* Chart fills remaining height */}
        <div className="flex-1 min-h-0">
          <AssetChart
            chart={chart}
            ticker={etf.ticker}
            currency={etf.currency}
            kind={kind}
          />
        </div>

        {/* Range bar */}
        <div className="px-4 py-1.5 shrink-0 flex items-center justify-between gap-3">
          <ChartRangeBar chart={chart} />
        </div>

        {/* Bottom drawer: drag the handle, click it, or use arrow keys to resize */}
        <motion.div
          initial={false}
          animate={{ height: drawerH }}
          transition={dragging ? { duration: 0 } : { duration: 0.28, ease: EASE }}
          className="shrink-0 border-t border-hairline overflow-hidden flex flex-col"
        >
          <div className="relative h-0 shrink-0">
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize panel"
              aria-valuenow={drawerH}
              aria-valuemin={MIN_DRAWER}
              tabIndex={0}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { y: e.clientY, h: drawerH, moved: false };
                setDragging(true);
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d) return;
                const dy = d.y - e.clientY;
                if (Math.abs(dy) > 3) d.moved = true;
                if (d.moved) applyHeight(d.h + dy);
              }}
              onPointerUp={() => {
                const d = drag.current;
                drag.current = null;
                setDragging(false);
                if (d && !d.moved) toggleDrawer();
              }}
              onPointerCancel={() => {
                drag.current = null;
                setDragging(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleDrawer();
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  applyHeight(drawerH + DRAWER_STEP);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  applyHeight(drawerH - DRAWER_STEP);
                }
              }}
              className="group absolute inset-x-0 -top-2 z-10 flex h-3 cursor-row-resize touch-none items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-compass"
            >
              <span className="h-1 w-10 rounded-full bg-hairline-strong group-hover:bg-muted transition-colors duration-75" />
            </div>
          </div>
          <div className="flex h-9 shrink-0 items-center justify-between px-3">
            <div role="tablist" aria-label="Asset panels" className="flex items-center gap-1">
              {DRAWER_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`${drawerId}-tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls={`${drawerId}-panel`}
                  onClick={() => {
                    if (drawerOpen && tab === t.id) {
                      setDrawerH(MIN_DRAWER);
                      return;
                    }
                    setTab(t.id);
                    if (!drawerOpen) applyHeight(lastOpenH.current);
                  }}
                  className={cn(
                    "relative px-2.5 h-9 text-xs font-medium transition-colors duration-75 focus-visible:outline-2 focus-visible:outline-compass",
                    tab === t.id ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {t.label}
                  {tab === t.id && (
                    <motion.span
                      layoutId={`${drawerId}-underline`}
                      aria-hidden="true"
                      className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-ink"
                      transition={{ duration: 0.28, ease: EASE }}
                    />
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={toggleDrawer}
              aria-expanded={drawerOpen}
              aria-controls={`${drawerId}-panel`}
              aria-label={drawerOpen ? "Collapse panel" : "Expand panel"}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:bg-surface-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-compass"
            >
              <ChevronDown
                className={cn("w-4 h-4 transition-transform duration-200", !drawerOpen && "rotate-180")}
                aria-hidden="true"
              />
            </button>
          </div>
          <div
            id={`${drawerId}-panel`}
            role="tabpanel"
            aria-labelledby={`${drawerId}-tab-${tab}`}
            inert={!drawerOpen}
            className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 py-2"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {tab === "portfolio" && (
                  <PortfolioTab portfolio={portfolio} onRemove={onRemove} />
                )}
                {tab === "verdict" && <EtfVerdictCard etf={etf} history={chart.series} />}
                {tab === "profile" && (
                  <AssetProfileCard
                    ticker={etf.ticker}
                    assetType={etf.assetType === "STOCK" ? "STOCK" : "ETF"}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
      <ComparisonModal
        baseAsset={etf}
        isOpen={showCompare}
        onClose={() => setShowCompare(false)}
      />
    </>
  );
}

function PortfolioTab({
  portfolio,
  onRemove,
}: {
  portfolio: PortfolioItem[];
  onRemove: (ticker: string) => void;
}) {
  if (portfolio.length === 0) {
    return (
      <div className="py-4 flex items-center justify-center text-xs text-muted text-center">
        Your portfolio is empty. Add an asset to start.
      </div>
    );
  }
  return (
    <ul aria-label="Your holdings" className="divide-y divide-hairline">
      {portfolio.map((item) => (
        <li key={item.ticker} className="flex items-center gap-3 py-1.5 min-h-9">
          <span className="text-xs font-bold text-ink w-16 shrink-0 truncate">
            {item.ticker}
          </span>
          <span className="text-xs text-muted truncate flex-1" title={item.name}>
            {item.name}
          </span>
          <span className="text-xs font-bold text-ink font-mono shrink-0">
            {formatCurrency(item.price, item.currency)}
          </span>
          <button
            type="button"
            onClick={() => onRemove(item.ticker)}
            aria-label={`Remove ${item.ticker} from portfolio`}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:bg-surface-soft hover:text-ink shrink-0 focus-visible:outline-2 focus-visible:outline-compass"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
