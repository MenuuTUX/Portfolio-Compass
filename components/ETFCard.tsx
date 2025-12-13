import { memo } from 'react';
import { ArrowUpRight, ArrowDownRight, Maximize2, Plus, Check, Trash2 } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { cn, formatCurrency } from '@/lib/utils';
import { ETF } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

interface SparklineProps {
  data: { date: string; price: number }[];
  color: string;
}

const Sparkline = memo(({ data, color }: SparklineProps) => (
  <div className="h-16 w-32">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <YAxis domain={['dataMin', 'dataMax']} hide />
        <Line
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
    <table className="sr-only">
      <caption>Price History Sparkline</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Price</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, i) => (
          <tr key={i}>
            <td>{new Date(item.date).toLocaleDateString()}</td>
            <td>{formatCurrency(item.price)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
));

Sparkline.displayName = 'Sparkline';

interface ETFCardProps {
  etf: ETF;
  inPortfolio: boolean;
  flashState: 'success' | 'error' | null;
  syncingTicker: string | null;
  onAdd: (etf: ETF) => void;
  onRemove: (ticker: string) => void;
  onAdvancedView: (etf: ETF) => void;
}

export const ETFCard = memo(({
  etf,
  inPortfolio,
  flashState,
  syncingTicker,
  onAdd,
  onRemove,
  onAdvancedView
}: ETFCardProps) => {
  const isPositive = etf.changePercent >= 0;

  return (
    <div
      className={cn(
        "glass-card rounded-xl relative overflow-hidden bg-white/5 border transition-all group flex flex-col h-full",
        inPortfolio
          ? "border-emerald-500/30 shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)]"
          : "border-white/5 hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]"
      )}
    >
      {/* Flash Overlay */}
      <AnimatePresence>
        {flashState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "absolute inset-0 z-20 pointer-events-none backdrop-blur-[2px]",
              flashState === 'success' ? "bg-emerald-500/20" : "bg-rose-500/20"
            )}
          />
        )}
      </AnimatePresence>

      {/* Green Blur Overlay for Owned Items */}
      {inPortfolio && (
        <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />
      )}

      <div className="p-6 transition-all duration-300 md:group-hover:blur-sm md:group-hover:opacity-30 flex-1">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">{etf.ticker}</h3>
            <p className="text-sm text-neutral-400 line-clamp-1" title={etf.name}>{etf.name}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Owned Indicator */}
            {inPortfolio && (
              <div className="flex items-center gap-1 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                <Check className="w-3 h-3" />
                OWNED
              </div>
            )}
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-sm font-medium",
              isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
            )}>
              {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(etf.changePercent).toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="flex justify-between items-end mb-6">
          <div>
            <div className="text-3xl font-light text-white">{formatCurrency(etf.price)}</div>
            <div className="text-xs text-neutral-500 mt-1">Closing Price</div>
          </div>
          {etf.history && etf.history.length > 0 && (
            <Sparkline
              data={etf.history}
              color={isPositive ? '#10b981' : '#f43f5e'}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
          <div>
            <div className="text-xs text-neutral-500 mb-1">Yield</div>
            <div className="text-sm font-medium text-emerald-400">{etf.metrics?.yield?.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500 mb-1">MER</div>
            <div className="text-sm font-medium text-neutral-300">{etf.metrics?.mer?.toFixed(2)}%</div>
          </div>
        </div>
      </div>

      {/* Mobile Actions (Visible by default) */}
      <div className="flex md:hidden border-t border-white/10 divide-x divide-white/10">
        {inPortfolio ? (
          <button
            onClick={() => onRemove(etf.ticker)}
            className="flex-1 py-3 bg-rose-500/10 text-rose-400 font-medium flex items-center justify-center gap-2 active:bg-rose-500/20"
          >
            <Trash2 className="w-4 h-4" /> Remove
          </button>
        ) : (
          <button
            onClick={() => onAdd(etf)}
            className="flex-1 py-3 bg-emerald-500/10 text-emerald-400 font-medium flex items-center justify-center gap-2 active:bg-emerald-500/20"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        )}
        <button
          onClick={() => onAdvancedView(etf)}
          disabled={syncingTicker === etf.ticker}
          className="flex-1 py-3 bg-white/5 text-white font-medium flex items-center justify-center gap-2 active:bg-white/10 disabled:opacity-50"
        >
          {syncingTicker === etf.ticker ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
          View
        </button>
      </div>

      {/* Desktop Overlay (Hover only) */}
      <div className="hidden md:flex absolute inset-0 flex-col items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none group-hover:pointer-events-auto bg-black/60 backdrop-blur-sm">
        {inPortfolio ? (
          <button
            onClick={() => onRemove(etf.ticker)}
            className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-6 rounded-full flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-75 shadow-lg shadow-rose-500/20"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </button>
        ) : (
          <button
            onClick={() => onAdd(etf)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-6 rounded-full flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-75 shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            Add to Portfolio
          </button>
        )}
        <button
          onClick={() => onAdvancedView(etf)}
          disabled={syncingTicker === etf.ticker}
          className="bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-6 rounded-full flex items-center gap-2 backdrop-blur-md border border-white/10 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncingTicker === etf.ticker ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
          {syncingTicker === etf.ticker ? 'Syncing...' : 'Advanced View'}
        </button>
      </div>

    </div>
  );
});

ETFCard.displayName = 'ETFCard';
