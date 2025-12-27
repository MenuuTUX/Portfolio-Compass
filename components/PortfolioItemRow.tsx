import { memo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { getAssetIconUrl } from '@/lib/etf-providers';
import { PortfolioItem } from '@/types';
import { motion } from 'framer-motion';
import { VirtualItem } from '@tanstack/react-virtual';
import Image from 'next/image';

interface PortfolioItemRowProps {
  item: PortfolioItem;
  virtualRow: VirtualItem;
  measureElement: (element: Element | null) => void;
  onRemove: (ticker: string) => void;
  onUpdateWeight: (ticker: string, weight: number) => void;
  onUpdateShares: (ticker: string, shares: number) => void;
}

const PortfolioItemRow = memo(({ item, virtualRow, measureElement, onRemove, onUpdateWeight, onUpdateShares }: PortfolioItemRowProps) => {
  const [imgError, setImgError] = useState(false);
  const iconUrl = getAssetIconUrl(item.ticker, item.name, item.assetType);

  return (
    <tr
      key={item.ticker}
      data-index={virtualRow.index}
      ref={measureElement}
      className="group bg-white/5 border-b border-white/5 hover:bg-white/10 transition-colors"
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
            <span className="font-bold text-white text-lg">{item.ticker}</span>
            <span className="text-xs text-neutral-400 truncate max-w-[150px]" title={item.name}>{item.name}</span>
          </div>
        </div>
      </td>

      <td className="p-4 align-top hidden md:table-cell">
        <div className="flex flex-col gap-1 text-xs text-neutral-400">
          <div className="flex justify-between w-24">
            <span>MER:</span>
            <span className="text-neutral-300">{item.metrics.mer}%</span>
          </div>
          <div className="flex justify-between w-24">
            <span>Yield:</span>
            <span className="text-emerald-400">{item.metrics.yield}%</span>
          </div>
        </div>
      </td>

      <td className="p-4 align-top">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
             <label htmlFor={`shares-${item.ticker}`} className="text-xs text-neutral-400 w-12 md:hidden">Shares</label>
             <input
              id={`shares-${item.ticker}`}
              type="number"
              value={item.shares || 0}
              onChange={(e) => onUpdateShares(item.ticker, parseFloat(e.target.value))}
              className="w-24 bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-right focus:border-emerald-500 focus:outline-none [color-scheme:dark] text-sm"
              aria-label={`Shares for ${item.ticker}`}
            />
          </div>
          <div className="flex items-center gap-2 md:hidden">
             <span className="text-xs text-neutral-400 w-12">Weight</span>
             <span className="text-xs text-white">{item.weight?.toFixed(2)}%</span>
          </div>
        </div>
      </td>

      <td className="p-4 align-top hidden md:table-cell">
        <div className="w-32">
          <label htmlFor={`weight-range-${item.ticker}`} className="flex justify-between text-xs text-neutral-400 mb-1 w-full">
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
            onChange={(e) => onUpdateWeight(item.ticker, parseFloat(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
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
}, (prevProps, nextProps) => {
  return (
    prevProps.item.ticker === nextProps.item.ticker &&
    prevProps.item.shares === nextProps.item.shares &&
    prevProps.item.weight === nextProps.item.weight &&
    prevProps.item.price === nextProps.item.price &&
    // Check virtualRow properties relevant for rendering/sizing
    prevProps.virtualRow.index === nextProps.virtualRow.index &&
    prevProps.virtualRow.size === nextProps.virtualRow.size &&
    prevProps.virtualRow.start === nextProps.virtualRow.start
  );
});

PortfolioItemRow.displayName = 'PortfolioItemRow';

export default PortfolioItemRow;
