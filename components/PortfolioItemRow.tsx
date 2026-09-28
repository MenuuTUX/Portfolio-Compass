import { memo, useState } from "react";
import { Trash2 } from "lucide-react";
import { getAssetIconUrl } from "@/lib/etf-providers";
import { getQuoteFreshness } from "@/lib/math/portfolio-returns";
import { quoteSessionLabel } from "@/lib/quote-session";
import { PortfolioItem } from "@/types";
import { motion } from "framer-motion";
import { VirtualItem } from "@tanstack/react-virtual";
import Image from "next/image";
import { HelpTip } from "./ui/HelpTip";
import { describeYieldProvenance, getSourcedYield, isUnverifiedProviderYield } from "@/lib/yield-provenance";
import { describeExpenseRatioProvenance, getSourcedExpenseRatio } from "@/lib/fee-provenance";

interface PortfolioItemRowProps {
  item: PortfolioItem;
  now?: number;
  virtualRow: VirtualItem;
  measureElement: (element: Element | null) => void;
  onRemove: (ticker: string) => void;
  onUpdateWeight: (ticker: string, weight: number) => void;
  onUpdateShares: (ticker: string, shares: number) => void;
}

const PortfolioItemRow = memo(
  ({
    item,
    now,
    virtualRow,
    measureElement,
    onRemove,
    onUpdateWeight,
    onUpdateShares,
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

    return (
      <tr
        key={item.ticker}
        data-index={virtualRow.index}
        ref={measureElement}
        className="group bg-surface-card border-b border-hairline hover:bg-surface-soft transition-colors"
        // Removed transform and fixed height to allow dynamic sizing and correct positioning via spacer rows
      >
        <td className="p-4 align-top">
          <div className="flex gap-3 items-center">
            {iconUrl && !imgError && (
              <div className="w-8 h-8 flex items-center justify-center shrink-0 relative">
                <Image
                  src={iconUrl}
                  alt={`${item.ticker} logo`}
                  className="object-contain"
                  width={32}
                  height={32}
                  onError={() => setImgError(true)}
                />
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-bold text-ink text-lg">
                {item.ticker}
              </span>
              <span
                className="text-xs text-neutral-400 truncate max-w-[150px]"
                title={item.name}
              >
                {item.name}
              </span>
              {!quoteMessage && quoteLabel && (
                <span className="text-[10px] text-muted">{quoteLabel}</span>
              )}
              {quoteMessage && <span className="text-xs text-amber-400">{quoteMessage}</span>}
            </div>
          </div>
        </td>

        <td className="p-4 align-top hidden md:table-cell">
          <div className="flex flex-col gap-1 text-xs text-neutral-400">
            {/* Expense ratios apply to funds and ETFs, not individual stocks. */}
            {item.assetType !== "STOCK" && (
              <div className="flex justify-between w-28 gap-2">
                <HelpTip
                  term="Provider-reported expense ratio"
                  showIcon={false}
                  className="text-neutral-400"
                >
                  Expense ratio:
                </HelpTip>
                <span className="text-neutral-300" title={describeExpenseRatioProvenance(item.metrics)}>
                  {expenseRatio != null ? `${expenseRatio.toFixed(2)}%` : "N/A"}
                </span>
              </div>
            )}
            {item.assetType === "STOCK" && (
              <div className="flex justify-between w-28 gap-2">
                <HelpTip
                  term="PE Ratio"
                  showIcon={false}
                  className="text-neutral-400"
                >
                  P/E:
                </HelpTip>
                <span className="text-neutral-300">
                  {item.peRatio != null && item.peRatio > 0
                    ? item.peRatio.toFixed(1)
                    : "N/A"}
                </span>
              </div>
            )}
            <div className="flex justify-between w-28 gap-2">
              <HelpTip
                term={yieldUnverified ? "Unverified Yahoo yield unavailable" : "Yield"}
                showIcon={false}
                className="text-neutral-400"
              >
                {yieldUnverified ? "Yahoo yield unavailable:" : "Yield:"}
              </HelpTip>
              <span
                className={yieldUnverified ? "text-neutral-400" : "text-emerald-400"}
                title={yieldProvenance}
              >
                {item.quoteStatus === "unavailable" || yieldValue == null ? "N/A" : `${yieldValue.toFixed(2)}%`}
              </span>
            </div>
            {yieldUnverified && yieldValue != null && (
              <span className="self-end text-[10px] text-neutral-500" title={yieldProvenance}>
                Yahoo-reported · unverified
              </span>
            )}
          </div>
        </td>

        <td className="p-4 align-top">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label
                htmlFor={`shares-${item.ticker}`}
                className="text-xs text-neutral-400 w-12 md:hidden"
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
                className="w-24 bg-black/50 border border-hairline rounded px-2 py-1 text-ink text-right focus:border-emerald-500 focus:outline-none [color-scheme:dark] text-sm"
                aria-label={`Shares for ${item.ticker}`}
              />
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <span className="text-xs text-neutral-400 w-12">Weight</span>
              <span className="text-xs text-ink">
                {item.weight?.toFixed(2)}%
              </span>
            </div>
          </div>
        </td>

        <td className="p-4 align-top hidden md:table-cell">
          <div className="w-32">
            <label
              htmlFor={`weight-range-${item.ticker}`}
              className="flex justify-between text-xs text-neutral-400 mb-1 w-full"
            >
              <span>Weight</span>
              <span>{item.weight?.toFixed(2)}%</span>
            </label>
            <input
              id={`weight-range-${item.ticker}`}
              type="range"
              min="0"
              max="100"
              step="1"
              value={item.weight}
              onChange={(e) =>
                onUpdateWeight(item.ticker, parseFloat(e.target.value))
              }
              className="w-full h-1.5 bg-surface-soft rounded-lg appearance-none cursor-pointer accent-emerald-500"
              aria-label={`Weight for ${item.ticker}`}
            />
          </div>
        </td>

        <td className="p-4 align-middle text-right">
          <button
            onClick={() => onRemove(item.ticker)}
            className="p-2 text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer rounded-full hover:bg-rose-500/10"
            aria-label={`Remove ${item.ticker}`}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </td>
      </tr>
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
      prevProps.item.dividendYield === nextProps.item.dividendYield &&
      prevProps.item.peRatio === nextProps.item.peRatio &&
      prevProps.item.metrics === nextProps.item.metrics &&
      prevProps.item.quoteAsOf === nextProps.item.quoteAsOf &&
      prevProps.item.quoteSession === nextProps.item.quoteSession &&
      prevProps.item.quoteStatus === nextProps.item.quoteStatus &&
      prevProps.now === nextProps.now &&
      // Check virtualRow properties relevant for rendering/sizing
      prevProps.virtualRow.index === nextProps.virtualRow.index &&
      prevProps.virtualRow.size === nextProps.virtualRow.size &&
      prevProps.virtualRow.start === nextProps.virtualRow.start
    );
  },
);

PortfolioItemRow.displayName = "PortfolioItemRow";

export default PortfolioItemRow;
