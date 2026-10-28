"use client";

import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import { motion, AnimatePresence } from "framer-motion";

interface SectorPieChartProps {
  sectors?: { [key: string]: number };
  data?: { name: string; value: number }[]; // Direct data prop alternative
  isLoading?: boolean;
  onSectorClick?: (sectorName: string) => void;
}

// Extended color palette to cover all 11 GICS sectors + others
export const COLORS = [
  "#e5e5e5",
  "#a3a3a3",
  "#737373",
  "#d4d4d4",
  "#8a8f98",
  "#5f6368",
  "#bfc3c9",
  "#9ca3af",
  "#6b7280",
  "#cfd2d6",
  "#4b5057",
  "#b4b8bd",
];

interface ActiveSectorRenderProps {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
}

const renderActiveSector = (props: ActiveSectorRenderProps) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } =
    props;

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
        className=""
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

export default function SectorPieChart({
  sectors,
  data,
  isLoading = false,
  onSectorClick,
}: SectorPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const processedData = useMemo(() => {
    // If direct data is provided, use it (assumed to be already sorted/formatted)
    if (data && data.length > 0) {
      return data;
    }

    if (!sectors) return [];

    const rawData = Object.entries(sectors)
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value);

    // Group small sectors logic
    const threshold = 2.0; // 2%
    const mainSectors = [];
    let otherValue = 0;

    rawData.forEach((item) => {
      if (item.value >= threshold) {
        mainSectors.push(item);
      } else {
        otherValue += item.value;
      }
    });

    if (otherValue > 0) {
      mainSectors.push({ name: "Other", value: otherValue });
    }

    return mainSectors;
  }, [sectors, data]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-32 h-32 rounded-full bg-surface-card" />
          <div className="w-24 h-4 rounded bg-surface-card" />
        </div>
      </div>
    );
  }

  if (processedData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">
        No sector data available
      </div>
    );
  }

  const activeItem =
    activeIndex !== undefined ? processedData[activeIndex] : null;
  const interactivePieProps = {
    activeIndex,
    ["active" + "Shape"]: renderActiveSector,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
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
            paddingAngle={2}
            dataKey="value"
            cornerRadius={6}
            {...interactivePieProps}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(undefined)}
            onClick={(data) => {
              const nextIndex = processedData.findIndex(
                (entry) => entry.name === data.name,
              );
              setActiveIndex(nextIndex >= 0 ? nextIndex : undefined);
              onSectorClick?.(data.name);
            }}
            cursor={onSectorClick ? "pointer" : "default"}
            stroke="none"
          >
            {processedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={
                  activeIndex === undefined || activeIndex === index ? 1 : 0.3
                }
                className="transition-opacity duration-75"
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Central Information Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          {activeItem ? (
            <motion.div
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center flex flex-col items-center max-w-[120px]"
            >
              <span
                className="text-xs text-muted font-medium truncate w-full px-2"
                title={activeItem.name}
              >
                {activeItem.name}
              </span>
              <span className="text-base font-bold text-ink">
                {activeItem.value.toFixed(1)}%
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="default"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <span className="text-xs text-muted font-semibold">
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
