'use client';

import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

interface SectorPieChartProps {
  sectors?: { [key: string]: number };
  data?: { name: string; value: number }[]; // Direct data prop alternative
  isLoading?: boolean;
  onSectorClick?: (sectorName: string) => void;
}

// Extended color palette to cover all 11 GICS sectors + others
export const COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#d946ef', // Fuchsia
  '#f97316', // Orange
  '#14b8a6', // Teal
];

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6} // Slightly larger on hover
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        className="drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]"
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={innerRadius - 4}
        outerRadius={innerRadius}
        fill={fill}
        fillOpacity={0.2}
      />
    </g>
  );
};

export default function SectorPieChart({ sectors, data, isLoading = false, onSectorClick }: SectorPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const processedData = useMemo(() => {
    // If direct data is provided, use it (assumed to be already sorted/formatted)
    if (data && data.length > 0) {
        return data;
    }

    if (!sectors) return [];

    const rawData = Object.entries(sectors).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);

    // Group small sectors logic
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
  }, [sectors, data]);

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
        <div className="h-full flex items-center justify-center text-neutral-400 text-sm">
        No sector data available
      </div>
    );
  }

  const activeItem = activeIndex !== undefined ? processedData[activeIndex] : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full min-h-[250px] relative"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={processedData}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={90}
            paddingAngle={4}
            dataKey="value"
            cornerRadius={6}
            {...{ activeIndex } as any} // Cast to any to bypass missing type definition in Recharts v3
            activeShape={renderActiveShape}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(undefined)}
            onClick={(data) => onSectorClick && onSectorClick(data.name)}
            cursor={onSectorClick ? "pointer" : "default"}
            stroke="none"
          >
            {processedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={activeIndex === undefined || activeIndex === index ? 1 : 0.3}
                className="transition-all duration-300"
              />
            ))}
          </Pie>
          <Tooltip
             contentStyle={{
                 backgroundColor: 'rgba(23, 23, 23, 0.9)', // neutral-900
                 backdropFilter: 'blur(8px)',
                 border: '1px solid rgba(255,255,255,0.1)',
                 borderRadius: '8px',
                 padding: '8px 12px',
                 boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
             }}
             itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 500 }}
             formatter={(value: any) => [`${Number(value).toFixed(2)}%`, '']}
             separator=""
             labelStyle={{ display: 'none' }}
           />
        </PieChart>
      </ResponsiveContainer>

      {/* Central Information Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          {activeItem ? (
            <motion.div
              key="active"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center flex flex-col items-center max-w-[120px]"
            >
              <span className="text-xs text-neutral-400 font-medium truncate w-full px-2" title={activeItem.name}>
                {activeItem.name}
              </span>
              <span className="text-xl font-bold text-white tracking-tight">
                {activeItem.value.toFixed(1)}%
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="default"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center"
            >
              <span className="text-xs text-neutral-500 uppercase tracking-widest font-semibold">
                Sectors
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <table className="sr-only">
        <caption>Sector Allocation</caption>
        <thead>
          <tr>
            <th scope="col">Sector</th>
            <th scope="col">Weight</th>
          </tr>
        </thead>
        <tbody>
          {processedData.map((item, index) => (
            <tr key={index}>
              <td>{item.name}</td>
              <td>{item.value.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}
