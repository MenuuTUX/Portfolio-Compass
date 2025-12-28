'use client';

import React, { useState, useMemo } from 'react';
import { Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CorrelationHeatmapProps {
  assets: string[];
}

export default function CorrelationHeatmap({ assets }: CorrelationHeatmapProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  // Logic: Mock correlation matrix
  // Uses a deterministic hash based on ticker pairs so values are consistent (but fake).
  // Diagonal is 1.0 (Dark Emerald)

  const n = assets.length;

  // Pseudo-random deterministic function
  const getCorrelation = (t1: string, t2: string) => {
    if (t1 === t2) return 1.0;
    // Ensure symmetry: Hash(A, B) must equal Hash(B, A)
    const sorted = [t1, t2].sort().join('');
    let hash = 0;
    for (let i = 0; i < sorted.length; i++) {
      hash = (hash * 31 + sorted.charCodeAt(i)) % 1000;
    }
    // Map to range -0.2 to 0.9 (some negative correlation possible)
    // 0 -> -0.2, 1000 -> 0.9
    return -0.2 + (hash / 1000) * 1.1;
  };

  const matrix: number[][] = useMemo(() => {
    const mat: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        mat[i][j] = getCorrelation(assets[i], assets[j]);
      }
    }
    return mat;
  }, [assets]);

  // Color logic
  const getColor = (value: number, isHovered: boolean, isRelated: boolean, hasHover: boolean) => {
    let base = '';

    if (value === 1.0) base = 'bg-emerald-900/40 border-emerald-500/20 text-emerald-600'; // Self
    else if (value > 0.7) base = 'bg-rose-900/40 border-rose-500/20 text-rose-400'; // High correlation
    else if (value < 0.3) base = 'bg-blue-900/40 border-blue-500/20 text-blue-400'; // Low correlation
    else base = 'bg-emerald-900/20 border-emerald-500/10 text-emerald-400'; // Moderate

    // Interaction states
    if (hasHover) {
      if (isHovered) return `${base} ring-2 ring-white/50 scale-105 z-20 shadow-lg brightness-110`;
      if (isRelated) return `${base} brightness-110 opacity-100`; // Keep related row/col standard brightness
      return `${base} opacity-30 grayscale`; // Dim everything else
    }

    return base;
  };

  if (n === 0) return null;

  return (
    <div className="w-full h-full min-h-[400px] glass-panel p-4 rounded-xl flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-start mb-4 z-10">
        <div>
           <h3 className="text-sm font-medium text-neutral-200">Correlation Matrix</h3>
           <p className="text-xs text-neutral-500">Diversification Analysis</p>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          aria-label="What does this mean?"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

       <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute inset-4 z-20 bg-stone-950/95 backdrop-blur-md border border-white/10 rounded-lg p-5 flex flex-col gap-3 shadow-2xl"
          >
             <div className="flex justify-between items-start">
                <h4 className="text-sm font-bold text-emerald-400">Understanding Correlation</h4>
                <button onClick={() => setShowInfo(false)} className="text-neutral-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-xs text-neutral-300 space-y-2 leading-relaxed overflow-y-auto">
              <p>
                Correlation measures how two assets move in relation to each other.
              </p>
              <ul className="list-disc pl-4 space-y-1 text-neutral-400">
                <li><strong className="text-rose-400">High (0.7 to 1.0):</strong> They move together. If one falls, the other likely falls. <strong>(Higher Risk)</strong></li>
                <li><strong className="text-emerald-400">Moderate (0.3 to 0.7):</strong> Some relationship, but not identical.</li>
                <li><strong className="text-blue-400">Low/Negative (&lt; 0.3):</strong> They move independently or oppositely. This is "Diversification". <strong>(Lower Risk)</strong></li>
              </ul>
              <p className="mt-2 text-emerald-300 italic border-l-2 border-emerald-500 pl-2">
                Goal: A portfolio with many <strong>Blue (Low Correlation)</strong> squares is better diversified and safer during crashes.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="flex-1 min-h-0 overflow-auto custom-scrollbar relative pt-6"
        onMouseLeave={() => setHoveredCell(null)}
      >
        <div
            className="grid gap-1 min-w-max"
            style={{
            gridTemplateColumns: `auto repeat(${n}, minmax(40px, 1fr))`,
            gridTemplateRows: `auto repeat(${n}, minmax(40px, 1fr))`
            }}
        >
             {/* Header Row (Corner) */}
             <div className="sticky top-0 left-0 z-20 bg-[#0a0a0a]"></div>

             {/* Header Row (Columns) */}
             {assets.map((ticker, j) => (
                 <div key={`col-${j}`} className="sticky top-0 z-10 bg-[#0a0a0a] flex items-end justify-center pb-2">
                     <span
                       className={`
                         text-[10px] font-bold rotate-[-45deg] origin-bottom-left translate-x-3 -translate-y-1 whitespace-nowrap transition-colors
                         ${hoveredCell && hoveredCell.col === j ? 'text-white scale-110' : 'text-neutral-400'}
                       `}
                     >
                         {ticker}
                     </span>
                 </div>
             ))}

            {/* Matrix Body */}
            {matrix.map((row, i) => (
            <React.Fragment key={`row-${i}`}>
                {/* Row Label */}
                 <div className="sticky left-0 z-10 bg-[#0a0a0a] flex items-center justify-end pr-2">
                    <span
                      className={`
                        text-[10px] font-bold transition-colors
                        ${hoveredCell && hoveredCell.row === i ? 'text-white scale-110' : 'text-neutral-400'}
                      `}
                    >
                      {assets[i]}
                    </span>
                 </div>

                {/* Cells */}
                {row.map((val, j) => {
                  const isHovered = hoveredCell?.row === i && hoveredCell?.col === j;
                  const isRelated = hoveredCell?.row === i || hoveredCell?.col === j;

                  return (
                    <div
                        key={`${i}-${j}`}
                        className={`
                        w-full h-10 min-w-[40px] rounded-sm border flex items-center justify-center
                        transition-all duration-300 cursor-crosshair
                        ${getColor(val, isHovered, isRelated, !!hoveredCell)}
                        `}
                        onMouseEnter={() => setHoveredCell({ row: i, col: j })}
                    >
                        <span className={`text-[9px] font-medium transition-opacity ${isHovered ? 'opacity-100' : 'opacity-70'}`}>
                            {val === 1.0 ? '' : val.toFixed(2)}
                        </span>
                    </div>
                  );
                })}
            </React.Fragment>
            ))}
        </div>
      </div>

      {/* Legend or Interaction Detail Box */}
      <div className="h-16 mt-3 border-t border-white/5 pt-2 flex items-center relative">
        <AnimatePresence mode="wait">
          {hoveredCell ? (
            <motion.div
              key="detail"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.15 }}
              className="w-full flex justify-between items-center"
            >
              <div className="flex flex-col">
                <span className="text-xs text-neutral-400 font-medium">
                  {assets[hoveredCell.row]} <span className="text-neutral-600">vs</span> {assets[hoveredCell.col]}
                </span>
                <span className={`text-lg font-bold ${
                  matrix[hoveredCell.row][hoveredCell.col] > 0.7 ? 'text-rose-400' :
                  matrix[hoveredCell.row][hoveredCell.col] < 0.3 ? 'text-blue-400' : 'text-emerald-400'
                }`}>
                  {matrix[hoveredCell.row][hoveredCell.col].toFixed(2)}
                </span>
              </div>
              <div className="text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded bg-white/5 border border-white/10 text-neutral-300">
                {matrix[hoveredCell.row][hoveredCell.col] > 0.7 ? 'High Correlation' :
                 matrix[hoveredCell.row][hoveredCell.col] < 0.3 ? 'Diversified' : 'Moderate'}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="legend"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-wrap gap-4 text-[10px] text-neutral-500"
            >
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-blue-500/40 rounded-sm"></div> Low (&lt;0.3)</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-500/20 rounded-sm"></div> Mod</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-rose-500/40 rounded-sm"></div> High (&gt;0.7)</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
