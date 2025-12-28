'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import { Portfolio } from '@/types';

interface PortfolioBarChartProps {
  portfolio: Portfolio;
}

export default function PortfolioBarChart({ portfolio }: PortfolioBarChartProps) {
  const data = useMemo(() => {
    // 1. Map existing holdings
    const holdings = portfolio.map(item => ({
      name: item.ticker,
      weight: item.weight,
      isCash: false,
      fill: '#10b981' // Emerald-500 default for assets
    }));

    // 2. Calculate Total Weight
    const totalWeight = portfolio.reduce((sum, item) => sum + item.weight, 0);

    // 3. Calculate Cash Buffer
    const cashBuffer = Math.max(0, 100 - totalWeight);

    // 4. Add Cash Buffer if significant
    if (cashBuffer > 0.01) {
      holdings.push({
        name: 'Cash Buffer',
        weight: cashBuffer,
        isCash: true,
        fill: '#525252' // Neutral-600 for cash
      });
    }

    // Sort by weight descending
    return holdings.sort((a, b) => b.weight - a.weight);
  }, [portfolio]);

  if (portfolio.length === 0) {
    return (
        <div className="w-full h-full min-h-[400px] flex items-center justify-center text-neutral-500 glass-panel rounded-xl">
            No assets in portfolio
        </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-full glass-panel p-4 rounded-xl flex flex-col"
    >
      <h3 className="text-sm font-medium text-neutral-400 mb-4">Portfolio Allocation (Equity vs Cash)</h3>
      <div className="flex-1 min-h-[400px]">
        {/* Debug Info (Hidden in Production via CSS if needed, but useful now) */}
        {/* <div className="text-xs text-neutral-600 mb-2 font-mono">
            Debug: {data.map(d => `${d.name}=${d.weight.toFixed(1)}%`).join(', ')}
        </div> */}

        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" />
            <XAxis type="number" domain={[0, 100]} stroke="#666" tickFormatter={(val) => `${val}%`} />
            <YAxis
                type="category"
                dataKey="name"
                width={80}
                stroke="#fff"
                tick={{ fontSize: 12 }}
                interval={0} // Force display all ticks
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-stone-950/90 backdrop-blur-md border border-white/10 p-2 rounded-lg text-xs shadow-xl z-50">
                      <div className="font-bold text-white mb-1">{d.name}</div>
                      <div className="flex justify-between gap-4">
                          <span className="text-neutral-400">Weight:</span>
                          <span className="text-white">{d.weight.toFixed(2)}%</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
                dataKey="weight"
                radius={[0, 4, 4, 0]}
                barSize={32}
                isAnimationActive={false} // Disable animation to ensure immediate render
            >
                {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
