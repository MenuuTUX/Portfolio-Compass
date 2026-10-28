import { memo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Trash2 } from "lucide-react";
import { EASE } from "./motion/Reveal";
import { getAssetIconUrl } from "@/lib/etf-providers";
import { getQuoteFreshness } from "@/lib/math/portfolio-returns";
import { quoteSessionLabel } from "@/lib/quote-session";
import { cn, formatCurrency } from "@/lib/utils";
import { PortfolioItem } from "@/types";
import Image from "next/image";
import { HelpTip } from "./ui/HelpTip";
import { describeYieldProvenance, getSourcedYield, isUnverifiedProviderYield } from "@/lib/yield-provenance";
import { describeExpenseRatioProvenance, getSourcedExpenseRatio } from "@/lib/fee-provenance";

interface PortfolioItemRowProps {
  item: PortfolioItem;
  now?: number;
  expanded: boolean;
  onToggle: (ticker: string) => void;
  onCollapse: () => void;
  onRemove: (ticker: string) => void;
  onUpdateWeight: (ticker: string, weight: number) => void;
  onUpdateShares: (ticker: string, shares: number) => void;
  /** Position in the list; drives the 30ms mount stagger. */
  index?: number;
  /** Masks the position value when the eye toggle is off. */
  hideValues?: boolean;
}

const PortfolioItemRow = memo(
  ({
    item,
    now,
    expanded,
    onToggle,
    onCollapse,
    onRemove,
    onUpdateWeight,
    onUpdateShares,
    index = 0,
    hideValues = false,
  }: PortfolioItemRowProps) => {
    const [imgError, setImgError] = useState(false);
    const iconUrl = getAssetIconUrl(item.ticker, item.name, item.assetType);
    const quoteFreshness = getQuoteFreshness(item.quoteAsOf, now);
    const quoteLabel = quoteSessionLabel(item.quoteSession);
    const quoteMessage = item.quoteStatus === "unavailable"
      ? "Latest quote unavailable"
      : quoteFreshness === "stale"
        ? "Stale quote · excluded from total"
        : quoteFreshness !== "fresh"
          ? "Quote timestamp unavailable or invalid"
          : null;
    const yieldValue = getSourcedYield(item.metrics, item.dividendYield);
    const yieldUnverified = isUnverifiedProviderYield(item.metrics?.yieldSource);
    const yieldProvenance = describeYieldProvenance(
      item.metrics?.yieldSource,
      item.metrics?.yieldRetrievedAt,
      item.metrics?.yieldSourceField,
      item.metrics?.yieldInputUnit,
      item.metrics?.yieldNormalization,
      item.metrics?.yieldMeasurementDate,
    );
    const expenseRatio = getSourcedExpenseRatio(item.metrics);

    const weight = item.weight ?? 0;
    const shares = item.shares || 0;
    const hasValue = shares > 0 && item.price > 0 && !quoteMessage;
    const valueText = hasValue
      ? hideValues
        ? "••••••"
        : formatCurrency(item.price * shares, item.currency)
      : `${weight.toFixed(1)}%`;
    const hasChange = !quoteMessage && Number.isFinite(item.changePercent);
    const change = hasChange ? item.changePercent : 0;

    const editorId = `holding-editor-${item.ticker}`;

    return (
      <motion.li
        layout="position"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE, delay: Math.min(index, 12) * 0.03 } }}
        exit={{ opacity: 0, height: 0, transition: { duration: 0.24, ease: EASE } }}
        className={cn("overflow-hidden transition-colors duration-150", expanded && "bg-surface-soft/40")}
        onKeyDown={(e) => {
          if (expanded && e.key === "Escape") {
            e.stopPropagation();
            onCollapse();
          }
        }}
      >
        <button
          type="button"
          onClick={() => onToggle(item.ticker)}
          aria-expanded={expanded}
          aria-controls={editorId}
          aria-label={`Edit ${item.ticker}`}
          className="flex w-full h-[42px] items-center gap-2.5 px-3 text-left transition-colors duration-75 hover:bg-surface-soft/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-compass cursor-pointer"
        >
          <div className="w-7 h-7 rounded-md bg-surface-soft flex items-center justify-center shrink-0 overflow-hidden">
            {iconUrl && !imgError ? (
              <Image
                src={iconUrl}
                alt={`${item.ticker} logo`}
                className="object-contain"
                width={20}
                height={20}
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="text-[10px] font-bold text-body-strong" aria-hidden="true">
                {item.ticker.slice(0, 2)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold leading-4 text-ink">{item.ticker}</p>
            <p className="truncate text-xs leading-4 text-muted" title={item.name}>
              {item.name}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-bold leading-4 text-ink tabular-nums">{valueText}</p>
            <p
              className={cn(
                "text-xs leading-4 tabular-nums",
                hasChange
                  ? change >= 0
                    ? "text-compass"
                    : "text-rose-400"
                  : "text-muted",
              )}
            >
              {hasChange
                ? `${change >= 0 ? "+" : "-"}${Math.abs(change).toFixed(2)}%`
                : hasValue
                  ? "No change"
                  : "target"}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 shrink-0 text-muted transition-transform duration-200",
              expanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>

        <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="editor"
            id={editorId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="overflow-hidden"
          >
          <div className="border-t border-hairline px-3 py-3 flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label
                  htmlFor={`weight-range-${item.ticker}`}
                  className="flex justify-between text-xs text-muted mb-2"
                >
                  <span>Target weight</span>
                  <span className="tabular-nums">{weight.toFixed(2)}%</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id={`weight-range-${item.ticker}`}
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={weight}
                    onChange={(e) =>
                      onUpdateWeight(item.ticker, parseFloat(e.target.value))
                    }
                    className="w-full h-1.5 bg-surface-soft rounded-lg appearance-none cursor-pointer accent-[var(--compass)]"
                    aria-label={`Weight for ${item.ticker}`}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={Number(weight.toFixed(2))}
                    onChange={(e) => {
                      const next = parseFloat(e.target.value);
                      if (Number.isFinite(next)) {
                        onUpdateWeight(item.ticker, Math.min(100, Math.max(0, next)));
                      }
                    }}
                    className="w-20 shrink-0 bg-surface-soft ring-1 ring-hairline rounded-lg px-2 py-1 min-h-[44px] md:min-h-0 text-ink text-right focus-visible:ring-2 focus-visible:ring-compass focus:outline-none [color-scheme:dark] text-sm tabular-nums"
                    aria-label={`Weight percent for ${item.ticker}`}
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor={`shares-${item.ticker}`}
                  className="block text-xs text-muted mb-2"
                >
                  Shares
                </label>
                <input
                  id={`shares-${item.ticker}`}
                  type="number"
                  value={item.shares || 0}
                  onChange={(e) =>
                    onUpdateShares(item.ticker, parseFloat(e.target.value))
                  }
                  className="w-full bg-surface-soft ring-1 ring-hairline rounded-lg px-2 py-1 min-h-[44px] md:min-h-0 text-ink text-right focus-visible:ring-2 focus-visible:ring-compass focus:outline-none [color-scheme:dark] text-sm tabular-nums"
                  aria-label={`Shares for ${item.ticker}`}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 text-xs text-muted">
              {quoteMessage ? (
                <p>{quoteMessage}</p>
              ) : (
                quoteLabel && <p>{quoteLabel}</p>
              )}
              {/* Expense ratios apply to funds and ETFs, not individual stocks. */}
              {item.assetType !== "STOCK" ? (
                <p className="flex gap-2">
                  <HelpTip
                    term="Provider-reported expense ratio"
                    showIcon={false}
                    className="text-muted"
                  >
                    Expense ratio:
                  </HelpTip>
                  <span className="text-body-strong" title={describeExpenseRatioProvenance(item.metrics)}>
                    {expenseRatio != null ? `${expenseRatio.toFixed(2)}%` : "N/A"}
                  </span>
                </p>
              ) : (
                <p className="flex gap-2">
                  <HelpTip term="PE Ratio" showIcon={false} className="text-muted">
                    P/E:
                  </HelpTip>
                  <span className="text-body-strong">
                    {item.peRatio != null && item.peRatio > 0
                      ? item.peRatio.toFixed(1)
                      : "N/A"}
                  </span>
                </p>
              )}
              <p className="flex gap-2">
                <HelpTip
                  term={yieldUnverified ? "Unverified Yahoo yield unavailable" : "Yield"}
                  showIcon={false}
                  className="text-muted"
                >
                  {yieldUnverified ? "Yahoo yield unavailable:" : "Yield:"}
                </HelpTip>
                <span
                  className={yieldUnverified ? "text-muted" : "text-body-strong"}
                  title={yieldProvenance}
                >
                  {item.quoteStatus === "unavailable" || yieldValue == null ? "N/A" : `${yieldValue.toFixed(2)}%`}
                </span>
              </p>
              {yieldUnverified && yieldValue != null && (
                <p className="text-muted-soft" title={yieldProvenance}>
                  Yahoo-reported · unverified
                </p>
              )}
            </div>

            <div>
              <button
                type="button"
                onClick={() => onRemove(item.ticker)}
                className="ws-pill gap-2"
                aria-label={`Remove ${item.ticker}`}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Remove
              </button>
            </div>
          </div>
          </motion.div>
        )}
        </AnimatePresence>
      </motion.li>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.item.ticker === nextProps.item.ticker &&
      prevProps.item.name === nextProps.item.name &&
      prevProps.item.assetType === nextProps.item.assetType &&
      prevProps.item.shares === nextProps.item.shares &&
      prevProps.item.weight === nextProps.item.weight &&
      prevProps.item.price === nextProps.item.price &&
      prevProps.item.currency === nextProps.item.currency &&
      prevProps.item.changePercent === nextProps.item.changePercent &&
      prevProps.item.dividendYield === nextProps.item.dividendYield &&
      prevProps.item.peRatio === nextProps.item.peRatio &&
      prevProps.item.metrics === nextProps.item.metrics &&
      prevProps.item.quoteAsOf === nextProps.item.quoteAsOf &&
      prevProps.item.quoteSession === nextProps.item.quoteSession &&
      prevProps.item.quoteStatus === nextProps.item.quoteStatus &&
      prevProps.now === nextProps.now &&
      prevProps.index === nextProps.index &&
      prevProps.hideValues === nextProps.hideValues &&
      prevProps.expanded === nextProps.expanded &&
      prevProps.onToggle === nextProps.onToggle &&
      prevProps.onCollapse === nextProps.onCollapse &&
      prevProps.onRemove === nextProps.onRemove &&
      prevProps.onUpdateWeight === nextProps.onUpdateWeight &&
      prevProps.onUpdateShares === nextProps.onUpdateShares
    );
  },
);

PortfolioItemRow.displayName = "PortfolioItemRow";

export default PortfolioItemRow;
