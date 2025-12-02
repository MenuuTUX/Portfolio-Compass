'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

interface SectorPieChartProps {
  sectors: { [key: string]: number };
  isLoading?: boolean;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

export default function SectorPieChart({ sectors, isLoading = false }: SectorPieChartProps) {
  const processedData = useMemo(() => {
    if (!sectors) return [];

    const rawData = Object.entries(sectors).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);

    const threshold = 2.0; // 2%
    const mainSectors = [];
    let otherValue = 0;

    rawData.forEach(item => {
      if (item.value >= threshold) {
        mainSectors.push(item);
      } else {
        otherValue += item.value;
      }
    });

    if (otherValue > 0) {
      mainSectors.push({ name: 'Other', value: otherValue });
    }

    return mainSectors;
  }, [sectors]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-32 h-32 rounded-full bg-white/5" />
          <div className="w-24 h-4 rounded bg-white/5" />
        </div>
      </div>
    );
  }

  if (processedData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
        No sector data available
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full min-h-[250px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={processedData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {processedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#171717', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
            itemStyle={{ color: '#fff' }}
            formatter={(value: number) => [`${value.toFixed(2)}%`, 'Weight']}
          />
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            iconSize={8}
            wrapperStyle={{ fontSize: '12px', color: '#a3a3a3' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
