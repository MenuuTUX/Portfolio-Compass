import { memo } from 'react';
import { Trash2 } from 'lucide-react';
import { PortfolioItem } from '@/types';
import { motion } from 'framer-motion';

interface PortfolioItemRowProps {
  item: PortfolioItem;
  style?: React.CSSProperties;
  onRemove: (ticker: string) => void;
  onUpdateWeight: (ticker: string, weight: number) => void;
  onUpdateShares: (ticker: string, shares: number) => void;
}

const PortfolioItemRow = memo(({ item, style, onRemove, onUpdateWeight, onUpdateShares }: PortfolioItemRowProps) => {
  return (
    <div style={style} className="px-1 py-2">
      <div className="glass-panel p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center gap-4 bg-white/5 border border-white/5 h-full">
        <div className="flex items-center justify-between w-full md:w-16">
          <div className="font-bold text-white">{item.ticker}</div>
          <button
            onClick={() => onRemove(item.ticker)}
            className="p-2 text-neutral-500 hover:text-rose-500 transition-colors cursor-pointer md:hidden"
            aria-label={`Remove ${item.ticker}`}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 w-full">
          <div className="text-sm text-neutral-400 truncate">{item.name}</div>
          <div className="flex gap-4 mt-1 text-xs text-neutral-500">
            <span>MER: {item.metrics.mer}%</span>
            <span>Yield: {item.metrics.yield}%</span>
          </div>
        </div>

        <div className="flex gap-4 w-full md:w-auto">
          <div className="flex-1 md:w-24">
            <label className="text-xs text-neutral-500 block mb-1">Shares</label>
            <input
              type="number"
              value={item.shares || 0}
              onChange={(e) => onUpdateShares(item.ticker, parseFloat(e.target.value))}
              className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-right focus:border-emerald-500 focus:outline-none [color-scheme:dark]"
            />
          </div>

          <div className="flex-1 md:w-32">
            <label className="text-xs text-neutral-500 block mb-1">Weight: {item.weight}%</label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={item.weight}
              onChange={(e) => onUpdateWeight(item.ticker, parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        </div>

        <button
          onClick={() => onRemove(item.ticker)}
          className="p-2 text-neutral-500 hover:text-rose-500 transition-colors cursor-pointer hidden md:block"
          aria-label={`Remove ${item.ticker}`}
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom equality check for performance
  return (
    prevProps.item.ticker === nextProps.item.ticker &&
    prevProps.item.shares === nextProps.item.shares &&
    prevProps.item.weight === nextProps.item.weight &&
    prevProps.item.price === nextProps.item.price &&
    prevProps.style === nextProps.style // vital for virtualization
  );
});

PortfolioItemRow.displayName = 'PortfolioItemRow';

export default PortfolioItemRow;
