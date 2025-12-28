'use client';

import React from 'react';

interface CorrelationHeatmapProps {
  assets: string[];
}

export default function CorrelationHeatmap({ assets }: CorrelationHeatmapProps) {
  // Logic: Mock correlation matrix
  // Diagonal is 1.0 (Dark Emerald)
  // Others: Random 0.2 - 0.8

  // Create a grid of values
  const n = assets.length;
  const matrix: number[][] = React.useMemo(() => {
    const mat: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          mat[i][j] = 1.0;
        } else if (j > i) {
          // Symmetric random for upper triangle
          const val = 0.2 + Math.random() * 0.6; // 0.2 to 0.8
          mat[i][j] = val;
          mat[j][i] = val; // Mirror
        }
      }
    }
    return mat;
  }, [n]); // Only recalculate if asset count changes (not ideal for stability but fine for mock)

  // Color logic
  const getColor = (value: number) => {
    if (value === 1.0) return 'bg-emerald-900/50 border-emerald-500/30'; // Self
    if (value > 0.7) return 'bg-rose-500/40 border-rose-500/20'; // High correlation
    if (value < 0.3) return 'bg-blue-500/40 border-blue-500/20'; // Low correlation
    return 'bg-emerald-500/20 border-emerald-500/10'; // Moderate
  };

  const getTooltipText = (val: number, row: number, col: number) => {
    return `${assets[row]} x ${assets[col]}: ${val.toFixed(2)}`;
  };

  if (n === 0) return null;

  return (
    <div className="w-full h-[300px] glass-panel p-4 rounded-xl flex flex-col overflow-hidden">
      <h3 className="text-sm font-medium text-neutral-400 mb-4">Correlation Matrix (Diversification)</h3>
      <div
        className="grid gap-1 flex-1 min-h-0 overflow-auto"
        style={{
          gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${n}, minmax(0, 1fr))`
        }}
      >
        {matrix.map((row, i) => (
          row.map((val, j) => (
            <div
              key={`${i}-${j}`}
              className={`
                w-full h-full rounded-sm border transition-all duration-200
                hover:scale-110 hover:z-10 relative group
                ${getColor(val)}
              `}
              title={getTooltipText(val, i, j)}
            >
              {/* Tooltip on hover using standard title, or could be custom overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                 {/* Too small for text usually, rely on title or outer tooltip if needed */}
              </div>
            </div>
          ))
        ))}
      </div>
      {/* Legend */}
      <div className="flex justify-between items-center mt-3 text-[10px] text-neutral-500">
        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-500/40 rounded-sm"></div> Low (&lt;0.3)</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500/20 rounded-sm"></div> Mod</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-rose-500/40 rounded-sm"></div> High (&gt;0.7)</div>
      </div>
    </div>
  );
}
