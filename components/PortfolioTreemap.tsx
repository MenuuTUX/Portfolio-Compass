'use client';

import React from 'react';
import {
  Treemap,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { motion } from 'framer-motion';
import { Portfolio } from '@/types';

interface PortfolioTreemapProps {
  portfolio: Portfolio;
}

// Custom Content Renderer for Treemap
const CustomizedContent = (props: any) => {
  const { root, depth, x, y, width, height, index, payload, colors, rank, name } = props;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: payload.fill || '#333',
          stroke: '#1c1917', // stone-900
          strokeWidth: 2,
          strokeOpacity: 1,
        }}
      />
      {width > 30 && height > 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          fill="#fff"
          fontSize={Math.min(width / 3, height / 3, 14)}
          className="font-bold pointer-events-none select-none"
        >
          {name}
        </text>
      )}
      {width > 50 && height > 50 && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 14}
          textAnchor="middle"
          fill="rgba(255,255,255,0.7)"
          fontSize={10}
          className="pointer-events-none select-none"
        >
          {payload.weight}%
        </text>
      )}
    </g>
  );
};

export default function PortfolioTreemap({ portfolio }: PortfolioTreemapProps) {
  // Transform data for Treemap
  // Treemap expects hierarchical data or flat array with 'value'
  const data = React.useMemo(() => {
    return portfolio.map((item) => {
       // Daily change determines color intensity/hue
       // Green for positive, Red for negative.
       // Opacity or brightness could vary, but for simplicity we pick a solid color from palette.

       const change = item.changePercent || 0; // Assuming changePercent is daily change
       const isPositive = change >= 0;

       // Calculate opacity based on magnitude? For now just static colors to keep it simple and clean.
       // Or map to a scale.
       let fill = '#525252';
       if (isPositive) {
         if (change > 1.5) fill = '#10b981'; // Emerald 500
         else if (change > 0.5) fill = '#34d399'; // Emerald 400
         else fill = '#059669'; // Emerald 600
       } else {
         if (change < -1.5) fill = '#f43f5e'; // Rose 500
         else if (change < -0.5) fill = '#fb7185'; // Rose 400
         else fill = '#e11d48'; // Rose 600
       }

       return {
         name: item.ticker,
         size: item.weight, // Value for area
         weight: item.weight.toFixed(2),
         change: change.toFixed(2),
         fill: fill,
       };
    });
  }, [portfolio]);

  if (portfolio.length === 0) {
    return (
        <div className="w-full h-[400px] flex items-center justify-center text-neutral-500 glass-panel rounded-xl">
            No assets in portfolio
        </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-[500px] glass-panel p-4 rounded-xl flex flex-col"
    >
      <h3 className="text-sm font-medium text-neutral-400 mb-4">Portfolio Weight Allocation</h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke="#fff"
            fill="#8884d8"
            content={<CustomizedContent />}
          >
             <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-stone-950/90 backdrop-blur-md border border-white/10 p-2 rounded-lg text-xs shadow-xl">
                      <div className="font-bold text-white mb-1">{d.name}</div>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                            <span className="text-neutral-400">Weight:</span>
                            <span className="text-white">{d.weight}%</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-neutral-400">Change:</span>
                            <span className={parseFloat(d.change) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {d.change}%
                            </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
