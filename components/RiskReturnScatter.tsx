'use client';

import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { PortfolioItem } from '@/types';

interface RiskReturnScatterProps {
  items: PortfolioItem[];
}

export default function RiskReturnScatter({ items }: RiskReturnScatterProps) {
  const data = items.map((item) => {
    // Determine risk (Beta). Default to 1 (Market) if missing.
    const beta = item.beta ?? 1.0;

    // Determine return (Yield + 5Y Dividend Growth).
    const yieldVal = item.metrics?.yield ?? 0;
    const growthVal = item.dividendGrowth5Y ?? 0;
    const totalReturn = yieldVal + growthVal;

    return {
      ticker: item.ticker,
      name: item.name,
      x: beta, // Risk
      y: totalReturn, // Return
      z: item.weight, // Weight (Bubble size)
      fill: beta > 1.2 ? '#f43f5e' : '#10b981', // Rose if High Risk, else Emerald
    };
  });

  return (
    <div className="w-full h-[300px] glass-panel p-4 rounded-xl flex flex-col">
      <h3 className="text-sm font-medium text-neutral-400 mb-4">Portfolio Efficiency (Risk vs Return)</h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
            <XAxis
              type="number"
              dataKey="x"
              name="Risk (Beta)"
              tick={{ fill: '#a3a3a3', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#404040' }}
              domain={['auto', 'auto']}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Expected Return (%)"
              tick={{ fill: '#a3a3a3', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#404040' }}
              unit="%"
            />
            <ZAxis type="number" dataKey="z" range={[50, 400]} name="Weight" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: '#525252' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-stone-950/90 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-xl">
                      <p className="font-bold text-white mb-1">{d.ticker}</p>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-400">Risk (Beta):</span>
                          <span className={d.x > 1.2 ? 'text-rose-400' : 'text-emerald-400'}>
                            {d.x.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-400">Exp. Return:</span>
                          <span className="text-emerald-400">{d.y.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-400">Weight:</span>
                          <span className="text-white">{d.z.toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine x={1} stroke="#525252" strokeDasharray="3 3" label={{ value: 'Market', position: 'insideTopRight', fill: '#737373', fontSize: 10 }} />

            <Scatter name="Assets" data={data}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
