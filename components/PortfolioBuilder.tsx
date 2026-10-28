"use client";

import { cn, formatCurrency } from "@/lib/utils";
import { RefreshCw, Eye, EyeOff, ChevronDown } from "lucide-react";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import Reveal, { EASE } from "./motion/Reveal";
import HeroChart from "./home/HeroChart";
import RangeChips from "./home/RangeChips";
import { availableRanges, buildPortfolioIndex, sliceIndex, type IndexRange } from "@/lib/portfolio-history";
import { getPortfolioValuation } from "@/lib/math/portfolio-returns";
import { useBankOfCanadaFx } from "@/hooks/useBankOfCanadaFx";
import { Portfolio } from "@/types";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import PortfolioItemRow from "./PortfolioItemRow";
import { Decimal } from "@/lib/decimal";
import WealthProjector from "./WealthProjector";
import ContributePopup from "./ContributePopup";
import OptimizationPanel from "./OptimizationPanel";
import AlgorithmExplainer from "./AlgorithmExplainer";
import RiskReturnScatter from "./RiskReturnScatter";
import PortfolioBarChart from "./PortfolioBarChart";
import SectorPieChart, { COLORS } from "./SectorPieChart";
import {
  LEFT_PANE,
  RIGHT_PANE,
  maxLeftPane,
  maxRightPane,
  PaneResizer,
  useResizableWidth,
} from "./workspace/PaneResizer";

type NavTab = "TRENDING" | "ETFS" | "STOCKS" | "PORTFOLIO";
type DrawerTab = "ALLOCATION" | "OPTIMIZER" | "RISK";

const DRAWER_TABS: readonly (readonly [DrawerTab, string])[] = [
  ["ALLOCATION", "Allocation"],
  ["OPTIMIZER", "Optimizer"],
  ["RISK", "Risk"],
];
const DRAWER_HEADER = 36;
const DRAWER_OPEN_HEIGHT = 320;
const DRAWER_MIN_OPEN = 120;
// Space the title, hero chart, range chips and caption need above the drawer
const DRAWER_TOP_RESERVE = 400;

/** Eases between values after the first render; the first render shows the value as is. */
function AnimatedText({ value, format, className }: { value: number; format: (v: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current === value) return;
    const controls = animate(previous.current, value, {
      duration: 0.7,
      ease: EASE,
      onUpdate: (v) => setShown(v),
      onComplete: () => setShown(value),
    });
    previous.current = value;
    return () => controls.stop();
  }, [value]);
  return <span className={className}>{format(reduce ? value : shown)}</span>;
}

interface PortfolioBuilderProps {
  portfolio: Portfolio;
  onRemove: (ticker: string) => void;
  onUpdateWeight: (ticker: string, weight: number) => void;
  onUpdateShares: (ticker: string, shares: number) => void;
  onClear: () => void;
  /** Optional: lets the empty state send people to the asset browsers. */
  onNavigate?: (tab: NavTab) => void;
}

export default function PortfolioBuilder({
  portfolio,
  onRemove,
  onUpdateWeight,
  onUpdateShares,
  onClear,
  onNavigate,
}: PortfolioBuilderProps) {
  const [viewMode, setViewMode] = useState<"BUILDER" | "PROJECTION">("BUILDER");
  const [showContributePopup, setShowContributePopup] = useState(false);
  const [hideValues, setHideValues] = useState(false);
  const [indexRange, setIndexRange] = useState<IndexRange>("ALL");

  // New internal view state for the Builder section
  // Renamed 'TREEMAP' to 'ALLOCATION'
  const portfolioIndex = useMemo(() => buildPortfolioIndex(portfolio), [portfolio]);
  const indexRanges = useMemo(() => availableRanges(portfolioIndex), [portfolioIndex]);
  const indexPoints = useMemo(
    () => sliceIndex(portfolioIndex, indexRanges.includes(indexRange) ? indexRange : "ALL"),
    [portfolioIndex, indexRanges, indexRange],
  );
  const [drawerTab, setDrawerTab] = useState<DrawerTab | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerH, setDrawerH] = useState(DRAWER_OPEN_HEIGHT);
  const [drawerDragging, setDrawerDragging] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerDrag = useRef<{ y: number; h: number } | null>(null);
  const left = useResizableWidth("pf-left", LEFT_PANE.initial, LEFT_PANE.min, maxLeftPane);
  const right = useResizableWidth("pf-right", RIGHT_PANE.initial, RIGHT_PANE.min, maxRightPane);
  // The drawer may take at most 75% of the center panel
  // and always leaves room above for the title, chart and caption
  const clampDrawer = (h: number) => {
    const parentH = drawerRef.current?.parentElement?.clientHeight ?? 800;
    return Math.round(
      Math.max(DRAWER_MIN_OPEN, Math.min(parentH * 0.75, parentH - DRAWER_TOP_RESERVE, h)),
    );
  };
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsLg(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(200);
  const hasChart = indexPoints.length > 1;
  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setChartHeight(Math.max(140, Math.round(el.clientHeight))));
    ro.observe(el);
    setChartHeight(Math.max(140, Math.round(el.clientHeight)));
    return () => ro.disconnect();
  }, [hasChart]);

  const [isOptimizerActive, setIsOptimizerActive] = useState(true);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [valuationNow, setValuationNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setValuationNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const currencies = new Set(portfolio.filter((item) => item.shares > 0).map((item) => item.currency));
  const fxQuery = useBankOfCanadaFx(currencies.size > 1);
  const requestedBaseCurrency = currencies.size > 1 ? "CAD" : undefined;
  const portfolioValuation = getPortfolioValuation(
    portfolio,
    requestedBaseCurrency,
    valuationNow,
    fxQuery.data,
  );
  const portfolioCurrency = portfolioValuation.complete
    ? portfolioValuation.baseCurrency
    : null;
  const sameCurrencyValuation = !!portfolioCurrency && !requestedBaseCurrency;
  const projectionAvailable = portfolioValuation.complete;
  const optimizerAvailable = sameCurrencyValuation && portfolio.every((item) => item.currency === portfolioCurrency);
  const mixedFxInternalsMessage = "The simple projection starts from today's CAD-converted value and does not model future FX changes. Allocation scoring and Monte Carlo remain unavailable for mixed currencies.";
  const optimizerUnavailableMessage = sameCurrencyValuation
    ? "Allocation scoring is unavailable while a candidate uses a different currency from the held portfolio."
    : mixedFxInternalsMessage;
  const valuationUnavailableMessage = (() => {
    switch (portfolioValuation.unavailableReason) {
      case "quote-stale":
        return "A held quote is older than five days. Refresh quotes before using portfolio totals or projections.";
      case "quote-invalid":
        return "A held quote has an invalid timestamp. Refresh quotes before using portfolio totals or projections.";
      case "quote-from-future":
        return "A held quote timestamp is in the future. Refresh quotes before using portfolio totals or projections.";
      case "quote-unavailable":
        return "A held quote is unavailable. Refresh quotes before using portfolio totals or projections.";
      case "quote-missing":
        return `Only ${portfolioValuation.pricedHoldings} of ${portfolioValuation.heldHoldings} held positions have a fresh quote.`;
      case "currency-unavailable":
        return "A held quote is missing a supported currency.";
      case "unsupported-shares":
        return "A holding has an invalid share count, so portfolio totals and projections are unavailable.";
      case "fx-conversion-unavailable":
        return fxQuery.isError
          ? "Bank of Canada FX is unavailable. Mixed-currency totals are hidden until a fresh daily rate is available."
          : "A fresh Bank of Canada daily FX rate is unavailable. Mixed-currency totals are hidden.";
      default:
        return "Add holdings with fresh quotes and known currencies to calculate a total.";
    }
  })();

  // Calculate aggregate metrics using Decimal for precision (Layer 1)
  const { totalWeight } = useMemo(() => {
    return portfolio.reduce(
      (acc, item) => {
        const weight = new Decimal(item.weight || 0);

        return {
          totalWeight: acc.totalWeight.plus(weight),
        };
      },
      { totalWeight: new Decimal(0) },
    );
  }, [portfolio]);

  const isValid = totalWeight.minus(100).abs().lessThan(0.1);

  // Aggregate Sector Allocation
  const sectorAllocation = useMemo(() => {
    return portfolio.reduce((acc: { [key: string]: number }, item) => {
      if (item.sectors) {
        Object.entries(item.sectors).forEach(([sector, amount]) => {
          // Convert the sector slug into a readable title.
          const normalizedSector = sector
            .replace(/_/g, " ")
            .toLowerCase()
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

          acc[normalizedSector] =
            (acc[normalizedSector] || 0) + amount * (item.weight / 100);
        });
      }
      return acc;
    }, {});
  }, [portfolio]);

  // Local state for display to handle debounced sorting
  const [displayPortfolio, setDisplayPortfolio] =
    useState<Portfolio>(portfolio);
  const isInteracting = useRef(false);
  const sortTimeout = useRef<NodeJS.Timeout | null>(null);

  // Latest portfolio for the debounced re-sort: without this, the timeout in
  // handleInteraction would close over a stale portfolio snapshot
  const portfolioRef = useRef(portfolio);
  useEffect(() => {
    portfolioRef.current = portfolio;
  }, [portfolio]);

  // Sync portfolio props to displayPortfolio with debounce logic
  useEffect(() => {
    if (isInteracting.current) {
      setDisplayPortfolio((prev) => {
        const newPortfolio = [...prev];
        portfolio.forEach((updatedItem) => {
          const index = newPortfolio.findIndex(
            (p) => p.ticker === updatedItem.ticker,
          );
          if (index !== -1) {
            newPortfolio[index] = updatedItem;
          } else {
            newPortfolio.push(updatedItem);
          }
        });
        return newPortfolio.filter((p) =>
          portfolio.some((pi) => pi.ticker === p.ticker),
        );
      });
    } else {
      setDisplayPortfolio([...portfolio].sort((a, b) => b.weight - a.weight));
    }
  }, [portfolio]);

  const handleInteraction = useCallback(() => {
    isInteracting.current = true;
    if (sortTimeout.current) clearTimeout(sortTimeout.current);

    sortTimeout.current = setTimeout(() => {
      isInteracting.current = false;
      setDisplayPortfolio(
        [...portfolioRef.current].sort((a, b) => b.weight - a.weight),
      );
    }, 3000);
  }, []);

  const handleUpdateShares = useCallback(
    (ticker: string, shares: number) => {
      handleInteraction();
      onUpdateShares(ticker, shares);
    },
    [handleInteraction, onUpdateShares],
  );

  const handleUpdateWeight = useCallback(
    (ticker: string, weight: number) => {
      handleInteraction();
      onUpdateWeight(ticker, weight);
    },
    [handleInteraction, onUpdateWeight],
  );

  const pieData = Object.entries(sectorAllocation)
    .map(([name, value]) => ({
      name,
      value: value * 100,
    }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const handleToggleRow = useCallback(
    (ticker: string) => setExpandedTicker((cur) => (cur === ticker ? null : ticker)),
    [],
  );
  const handleCollapseRow = useCallback(() => setExpandedTicker(null), []);

  if (viewMode === "PROJECTION") {
    if (!projectionAvailable) {
      return (
        <section className="h-full min-h-0 overflow-y-auto p-0 text-ink">
          <Reveal onMount y={12} duration={0.5} className="ws-panel bg-surface-card rounded-lg ring-1 ring-hairline p-6">
            <button onClick={() => setViewMode("BUILDER")} className="underline">
              Back to portfolio
            </button>
            <p className="mt-4">
              {portfolioCurrency ? mixedFxInternalsMessage : valuationUnavailableMessage}
            </p>
          </Reveal>
        </section>
      );
    }
    return (
      <>
        {showContributePopup && (
          <ContributePopup onClose={() => setShowContributePopup(false)} />
        )}
        <Reveal onMount y={12} duration={0.5} className="h-full min-h-0 overflow-y-auto custom-scrollbar">
          <WealthProjector
            portfolio={portfolio}
            startingValue={portfolioValuation.totalValue!}
            baseCurrency={portfolioCurrency!}
            fxProvenance={requestedBaseCurrency ? fxQuery.data : undefined}
            onBack={() => setViewMode("BUILDER")}
          />
        </Reveal>
      </>
    );
  }

  const pill = "ws-pill";
  const mask = "••••••";
  const panel = "ws-panel bg-surface-card rounded-lg ring-1 ring-hairline";
  const totalValue = portfolio.length > 0 && portfolioCurrency ? portfolioValuation.totalValue! : null;
  const totalFallback = portfolio.length === 0 ? "Portfolio" : "Unavailable";
  // Value-weighted move from the latest quotes already held; same-currency only.
  const heldMove = (() => {
    if (!sameCurrencyValuation || !portfolioValuation.totalValue) return null;
    let delta = 0;
    for (const item of portfolio) {
      if (item.shares > 0 && item.price > 0 && Number.isFinite(item.changePercent)) {
        const prev = item.price / (1 + item.changePercent / 100);
        delta += (item.price - prev) * item.shares;
      }
    }
    const total = portfolioValuation.totalValue;
    const pct = total - delta ? (delta / (total - delta)) * 100 : 0;
    return { delta, pct };
  })();

  const optimizerActive = isOptimizerActive && portfolio.length > 0 && optimizerAvailable;
  const activeTab: DrawerTab = drawerTab ?? (optimizerActive ? "OPTIMIZER" : "ALLOCATION");
  const selectTab = (tab: DrawerTab) => {
    if (drawerOpen && activeTab === tab) {
      setDrawerOpen(false);
      return;
    }
    setDrawerTab(tab);
    setDrawerOpen(true);
  };
  const weighted = displayPortfolio.filter((item) => (item.weight || 0) > 0);
  const eyeIcon = hideValues
    ? <EyeOff className="w-4 h-4" aria-hidden="true" />
    : <Eye className="w-4 h-4" aria-hidden="true" />;

  const sectorXRay = (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-ink">Sector X-Ray</h3>
      <div className="w-full h-[220px] flex-shrink-0">
        {pieData.length > 0 ? (
          <SectorPieChart data={pieData} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted text-sm">
            Add holdings to see exposure
          </div>
        )}
      </div>
      {pieData.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {pieData.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-2 text-xs text-muted">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <span className="truncate">{entry.name}</span>
              <span className="ml-auto text-ink tabular-nums">{entry.value.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const drawerBody = (() => {
    if (activeTab === "OPTIMIZER") {
      return optimizerActive ? (
        <OptimizationPanel portfolio={portfolio} onCalibrating={setIsCalibrating} />
      ) : (
        <div className="flex flex-col gap-3">
          {!optimizerAvailable && portfolio.length > 0 && (
            <p className="text-xs text-muted">{optimizerUnavailableMessage}</p>
          )}
          {sectorXRay}
        </div>
      );
    }
    if (activeTab === "RISK") {
      return (
        <div className="min-h-[360px] lg:h-full lg:min-h-0">
          <RiskReturnScatter items={portfolio} />
        </div>
      );
    }
    return (
      <div className="grid h-full grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)] gap-6">
        <div className="min-h-[320px] lg:h-full lg:min-h-0">
          <PortfolioBarChart portfolio={portfolio} />
        </div>
        {sectorXRay}
      </div>
    );
  })();

  return (
    <section className="h-full min-h-0 overflow-y-auto lg:overflow-hidden custom-scrollbar text-ink">
      <div
        className={cn(
          "flex flex-col gap-2 lg:gap-0 lg:grid lg:h-full lg:min-h-0 lg:grid-rows-[minmax(0,1fr)]",
          (left.dragging || right.dragging || drawerDragging) && "select-none",
        )}
        style={isLg ? { gridTemplateColumns: `${left.width}px 0.5rem minmax(0,1fr) 0.5rem ${right.width}px` } : undefined}
      >
        {/* LEFT: holdings */}
        <Reveal onMount y={14} duration={0.5} className={cn(panel, "order-2 lg:order-1 flex min-h-0 flex-col overflow-hidden")}>
          <div className="flex items-center gap-2 px-3 h-11 shrink-0">
            <h2 className="text-sm font-bold text-ink">Holdings</h2>
            <span className="text-xs text-muted tabular-nums">{displayPortfolio.length}</span>
            {displayPortfolio.length > 0 && (
              <button
                type="button"
                onClick={() => setHideValues((v) => !v)}
                aria-pressed={hideValues}
                aria-label={hideValues ? "Show holding values" : "Hide holding values"}
                className="ws-icon-btn ml-auto"
              >
                {eyeIcon}
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar border-t border-hairline max-h-[60vh] lg:max-h-none">
            {displayPortfolio.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted">
                <p>Add assets from Markets, ETFs or Stocks</p>
                {onNavigate && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button type="button" className={pill} onClick={() => onNavigate("TRENDING")}>Markets</button>
                    <button type="button" className={pill} onClick={() => onNavigate("ETFS")}>ETFs</button>
                    <button type="button" className={pill} onClick={() => onNavigate("STOCKS")}>Stocks</button>
                  </div>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                <AnimatePresence initial>
                  {displayPortfolio.map((item, index) => (
                    <PortfolioItemRow
                      key={item.ticker}
                      item={item}
                      index={index}
                      hideValues={hideValues}
                      now={valuationNow}
                      expanded={expandedTicker === item.ticker}
                      onToggle={handleToggleRow}
                      onCollapse={handleCollapseRow}
                      onRemove={onRemove}
                      onUpdateWeight={handleUpdateWeight}
                      onUpdateShares={handleUpdateShares}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </Reveal>

        {isLg && (
          <PaneResizer
            label="Resize holdings panel"
            width={left.width}
            direction={1}
            onResize={left.setWidth}
            onCommit={left.persist}
            onDraggingChange={left.setDragging}
            onReset={left.reset}
            className="order-2"
          />
        )}

        {/* CENTER: header, chart, drawer */}
        <Reveal
          onMount
          y={14}
          duration={0.5}
          delay={0.06}
          className={cn(panel, "order-1 lg:order-3 flex min-h-0 min-w-0 flex-col overflow-hidden", isCalibrating && "opacity-80")}
        >
          <div className="shrink-0 px-4 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-sm font-bold text-ink">Portfolio</h1>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    const next = !isOptimizerActive;
                    setIsOptimizerActive(next);
                    setDrawerTab(next ? "OPTIMIZER" : null);
                    if (next) setDrawerOpen(true);
                  }}
                  disabled={!optimizerAvailable}
                  title={!optimizerAvailable ? optimizerUnavailableMessage : undefined}
                  aria-pressed={isOptimizerActive}
                  className={cn(pill, isOptimizerActive && "ring-1 ring-body-strong")}
                >
                  Allocation Mode
                </button>
                <button
                  onClick={() => {
                    setViewMode("PROJECTION");
                    setTimeout(() => setShowContributePopup(true), 800);
                  }}
                  disabled={!projectionAvailable}
                  title={!projectionAvailable ? valuationUnavailableMessage : undefined}
                  className={pill}
                >
                  See Growth Projection
                </button>
                <button onClick={onClear} className={pill}>
                  <RefreshCw className="w-4 h-4" aria-hidden="true" /> Reset
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <p className="text-[32px] font-bold text-ink leading-[38px] tabular-nums">
                {totalValue !== null ? (
                  hideValues ? mask : (
                    <AnimatedText value={totalValue} format={(v) => formatCurrency(v, portfolioCurrency!)} />
                  )
                ) : totalFallback}
              </p>
              {portfolio.length > 0 && portfolioCurrency && (
                <button
                  type="button"
                  onClick={() => setHideValues((v) => !v)}
                  aria-pressed={hideValues}
                  aria-label={hideValues ? "Show balances" : "Hide balances"}
                  className="ws-icon-btn"
                >
                  {eyeIcon}
                </button>
              )}
            </div>
            {heldMove ? (
              <p className={cn("mt-1 text-sm font-medium tabular-nums", heldMove.delta >= 0 ? "text-compass" : "text-rose-400")}>
                {hideValues
                  ? `${heldMove.pct >= 0 ? "+" : "-"}${Math.abs(heldMove.pct).toFixed(2)}% latest session`
                  : `${heldMove.delta >= 0 ? "+" : "-"}${formatCurrency(Math.abs(heldMove.delta), portfolioCurrency!)} (${heldMove.pct >= 0 ? "+" : "-"}${Math.abs(heldMove.pct).toFixed(2)}%) latest session`}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">
                Set holdings and weights. Aim for a 100% total allocation.
              </p>
            )}
          </div>

          <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
            {hasChart ? (
              <>
                <div ref={chartWrapRef} className="relative h-[200px] lg:h-auto lg:min-h-[140px] lg:flex-1 overflow-hidden">
                  <div className="absolute inset-x-0 top-0">
                    <HeroChart
                      points={indexPoints}
                      height={chartHeight}
                      label="Illustrative portfolio index"
                      formatValue={(v) => v.toFixed(1)}
                    />
                  </div>
                </div>
                <div className="shrink-0 px-4 pt-2">
                  <RangeChips
                    ranges={indexRanges}
                    value={indexRanges.includes(indexRange) ? indexRange : "ALL"}
                    onChange={setIndexRange}
                    label="Portfolio chart range"
                  />
                  <p className="mt-1.5 text-xs text-muted">
                    Illustrative only: your current target weights applied to past prices, starting at 100. Not your actual returns, and past prices do not predict future results.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex min-h-[120px] flex-1 items-center justify-center px-4 text-center text-sm text-muted">
                Add holdings with price history to see the illustrative index.
              </div>
            )}
          </div>

          <motion.div
            ref={drawerRef}
            initial={false}
            animate={{ height: drawerOpen ? (isLg ? drawerH : "auto") : DRAWER_HEADER }}
            transition={{ duration: drawerDragging ? 0 : 0.28, ease: EASE }}
            style={isLg && drawerOpen ? { maxHeight: `max(${DRAWER_MIN_OPEN}px, calc(100% - ${DRAWER_TOP_RESERVE}px))` } : undefined}
            className={cn("relative mt-2 flex shrink-0 flex-col overflow-hidden border-t border-hairline", isCalibrating && "pointer-events-none")}
          >
            {isLg && drawerOpen && (
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize analysis drawer"
                aria-valuenow={drawerH}
                tabIndex={0}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drawerDrag.current = { y: e.clientY, h: drawerH };
                  setDrawerDragging(true);
                }}
                onPointerMove={(e) => {
                  if (drawerDrag.current) setDrawerH(clampDrawer(drawerDrag.current.h - (e.clientY - drawerDrag.current.y)));
                }}
                onPointerUp={() => {
                  drawerDrag.current = null;
                  setDrawerDragging(false);
                }}
                onPointerCancel={() => {
                  drawerDrag.current = null;
                  setDrawerDragging(false);
                }}
                onDoubleClick={() => setDrawerH(clampDrawer(DRAWER_OPEN_HEIGHT))}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 48 : 16;
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setDrawerH(clampDrawer(drawerH + step));
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setDrawerH(clampDrawer(drawerH - step));
                  }
                }}
                className="group absolute inset-x-0 -top-px z-10 flex h-2 cursor-row-resize touch-none items-center justify-center focus-visible:outline-none"
              >
                <span className="h-0.5 w-10 rounded-full bg-transparent transition-colors duration-75 group-hover:bg-hairline-strong group-focus-visible:bg-compass" />
              </div>
            )}
            <div className="flex shrink-0 items-center gap-1 px-3" style={{ height: DRAWER_HEADER }}>
              <div role="tablist" aria-label="Portfolio analysis" className="flex items-center gap-1">
                {DRAWER_TABS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    id={`portfolio-tab-${key}`}
                    aria-selected={activeTab === key}
                    aria-controls="portfolio-drawer-panel"
                    onClick={() => selectTab(key)}
                    className={cn(
                      "relative px-3 h-9 text-xs font-medium whitespace-nowrap transition-colors duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass rounded-md",
                      activeTab === key ? "text-ink" : "text-muted hover:text-ink",
                    )}
                  >
                    {label}
                    {activeTab === key && (
                      <motion.span
                        layoutId="portfolio-drawer-underline"
                        className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-ink"
                        transition={{ duration: 0.24, ease: EASE }}
                      />
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen((v) => !v)}
                aria-expanded={drawerOpen}
                aria-controls="portfolio-drawer-panel"
                aria-label={drawerOpen ? "Collapse analysis drawer" : "Expand analysis drawer"}
                className="ws-icon-btn ml-auto"
              >
                <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", !drawerOpen && "rotate-180")} aria-hidden="true" />
              </button>
            </div>
            <div
              id="portfolio-drawer-panel"
              role="tabpanel"
              inert={!drawerOpen}
              aria-labelledby={`portfolio-tab-${activeTab}`}
              className="min-h-0 flex-1 overflow-y-auto custom-scrollbar border-t border-hairline p-4"
            >
              <motion.div
                key={activeTab}
                className="h-full"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                {drawerBody}
              </motion.div>
            </div>
          </motion.div>
        </Reveal>

        {isLg && (
          <PaneResizer
            label="Resize summary panel"
            width={right.width}
            direction={-1}
            onResize={right.setWidth}
            onCommit={right.persist}
            onDraggingChange={right.setDragging}
            onReset={right.reset}
            className="order-4"
          />
        )}

        {/* RIGHT: summary */}
        <Reveal onMount y={14} duration={0.5} delay={0.12} className={cn(panel, "order-3 lg:order-5 flex min-h-0 flex-col overflow-hidden")}>
          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-5">
            <div>
              <h2 className="text-sm font-bold text-ink">Target allocation</h2>
              <p className={cn("mt-1 text-[32px] font-bold leading-[38px] tabular-nums", portfolio.length > 0 && !isValid ? "text-rose-400" : "text-ink")}>
                {portfolio.length > 0 ? (
                  <AnimatedText value={totalWeight.toNumber()} format={(v) => `${v.toFixed(1)}%`} />
                ) : "0.0%"}
              </p>
              {portfolio.length > 0 && !isValid && <p className="text-xs text-rose-400">Should be 100%</p>}
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1.5 text-xs">
                <dt className="text-muted">Holdings</dt>
                <dd className="text-right font-medium text-ink tabular-nums">
                  {portfolio.length} {portfolio.length === 1 ? "asset" : "assets"}
                </dd>
              </dl>
            </div>

            {portfolio.length > 0 && (
              <div className="flex flex-col gap-2">
                {portfolioCurrency && requestedBaseCurrency && portfolioValuation.complete && (
                  <p className="text-xs text-muted">Values converted to CAD using Bank of Canada FXUSDCAD daily average dated {fxQuery.data?.date}.</p>
                )}
                {!portfolioCurrency && <p className="text-sm text-muted">{valuationUnavailableMessage}</p>}
                {portfolioCurrency && !sameCurrencyValuation && <p className="text-sm text-muted">{mixedFxInternalsMessage}</p>}
              </div>
            )}

            {weighted.length > 0 && totalWeight.greaterThan(0) && (
              <div className="flex flex-col gap-3" aria-label="Target allocation by holding">
                <h3 className="text-sm font-bold text-ink">Allocation</h3>
                <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Target weights">
                  {weighted.map((item, index) => (
                    <motion.div
                      key={item.ticker}
                      title={`${item.ticker} ${(item.weight || 0).toFixed(1)}%`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.weight / totalWeight.toNumber()) * 100}%` }}
                      transition={{ duration: 0.6, ease: EASE, delay: 0.2 + index * 0.06 }}
                      className="h-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                  ))}
                </div>
                <ul className="grid grid-cols-[1fr_auto] gap-y-1.5 text-xs text-muted">
                  {weighted.map((item, index) => (
                    <li key={item.ticker} className="col-span-2 grid grid-cols-subgrid items-center">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} aria-hidden="true" />
                        <span className="truncate text-body-strong">{item.ticker}</span>
                      </span>
                      <span className="text-right tabular-nums">{(item.weight || 0).toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-ink">Experimental score</h3>
              <p className="text-xs leading-5 text-muted">
                Allocation scores use proxy inputs, not forecasts or a recommendation. Nothing here can be applied as a trade.
              </p>
              {optimizerAvailable && portfolio.length > 0 && (
                <button type="button" className={cn(pill, "self-start")} onClick={() => selectTab("OPTIMIZER")}>
                  Open optimizer
                </button>
              )}
            </div>

            <details className="group border-t border-hairline pt-3">
              <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between text-sm font-bold text-ink [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass rounded-md">
                How the allocation model works
                <ChevronDown className="w-4 h-4 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="mt-3">
                <AlgorithmExplainer />
              </div>
            </details>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
