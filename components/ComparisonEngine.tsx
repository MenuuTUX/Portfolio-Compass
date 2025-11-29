'use client';

import { useState, useEffect } from 'react';
import { Search, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { cn, formatCurrency } from '@/lib/utils';
import { ETF } from '@/types';
import { motion } from 'framer-motion';

interface SparklineProps {
  data: number[];
  color: string;
}

// Sparkline component
const Sparkline = ({ data, color }: SparklineProps) => (
  <div className="h-16 w-32">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data.map((val, i) => ({ i, val }))}>
        <YAxis domain={['dataMin', 'dataMax']} hide />
        <Line
          type="monotone"
          dataKey="val"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

interface ComparisonEngineProps {
  onAddToPortfolio: (etf: ETF) => void;
}

export default function ComparisonEngine({ onAddToPortfolio }: ComparisonEngineProps) {
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/etfs.json')
      .then(res => res.json())
      .then((data: ETF[]) => {
        setEtfs(data);
        setLoading(false);
      })
      .catch(err => console.error("Failed to load ETF data", err));
  }, []);

  const filteredEtfs = etfs.filter(etf =>
    etf.ticker.toLowerCase().includes(search.toLowerCase()) ||
    etf.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="py-24 px-4 max-w-7xl mx-auto h-[calc(100vh-64px)] overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Market Engine</h2>
            <p className="text-neutral-400">Real-time analysis of leading ETFs. Click to add to builder.</p>
          </div>

          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-neutral-500" />
            </div>
            <input
              type="text"
              placeholder="Search ticker or name..."
              className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-lg bg-white/5 text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[1,2,3].map(i => (
               <div key={i} className="h-64 rounded-xl bg-white/5 animate-pulse" />
             ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
            {filteredEtfs.map((etf) => {
              const isPositive = etf.changePercent >= 0;
              return (
                <div
                  key={etf.ticker}
                  className="glass-card rounded-xl p-6 group cursor-pointer relative overflow-hidden bg-white/5 border border-white/5 hover:border-emerald-500/30 transition-all"
                  onClick={() => onAddToPortfolio(etf)}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded border border-emerald-500/30">
                      Add +
                    </div>
                  </div>

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-white tracking-tight">{etf.ticker}</h3>
                      <p className="text-sm text-neutral-400 line-clamp-1" title={etf.name}>{etf.name}</p>
                    </div>
                    <div className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded text-sm font-medium",
                      isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    )}>
                      {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {Math.abs(etf.changePercent)}%
                    </div>
                  </div>

                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <div className="text-3xl font-light text-white">{formatCurrency(etf.price)}</div>
                      <div className="text-xs text-neutral-500 mt-1">Closing Price</div>
                    </div>
                    <Sparkline
                      data={etf.history}
                      color={isPositive ? '#10b981' : '#f43f5e'}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div>
                      <div className="text-xs text-neutral-500 mb-1">Yield</div>
                      <div className="text-sm font-medium text-emerald-400">{etf.metrics.yield}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-neutral-500 mb-1">MER</div>
                      <div className="text-sm font-medium text-neutral-300">{etf.metrics.mer}%</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </section>
  );
}
