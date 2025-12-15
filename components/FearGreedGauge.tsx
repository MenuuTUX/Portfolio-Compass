'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface FearGreedData {
  score: number;
  rating: string;
  updatedAt: string;
}

export default function FearGreedGauge() {
  const [data, setData] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/market/fear-greed');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-48 bg-white/5 rounded-2xl animate-pulse flex items-center justify-center">
        <span className="text-white/20">Loading Market Sentiment...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full h-48 bg-white/5 rounded-2xl flex flex-col items-center justify-center gap-2">
        <span className="text-white/40">Sentiment Data Unavailable</span>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Visualization Constants
  const score = data.score;
  const radius = 80;
  const strokeWidth = 12; // Thinner stroke as per new image
  const center = { x: 100, y: 100 };

  // Calculate indicator position
  // Score 0 -> -180 degrees (Left)
  // Score 100 -> 0 degrees (Right)
  // Note: SVG 0 is 3 o'clock. We want -180 to 0.
  const angleDeg = -180 + (score / 100) * 180;
  const angleRad = (angleDeg * Math.PI) / 180;

  const indicatorX = center.x + radius * Math.cos(angleRad);
  const indicatorY = center.y + radius * Math.sin(angleRad);

  // Generate Segment Paths
  // Total span 180 degrees. 5 segments.
  // Gap of 4 degrees between segments.
  // Segment span = (180 - 4*4) / 5 = 164 / 5 = 32.8 degrees.
  const totalSpan = 180;
  const gap = 4;
  const segmentCount = 5;
  const segmentSpan = (totalSpan - (segmentCount - 1) * gap) / segmentCount;

  const colors = [
    '#f43f5e', // Red (Extreme Fear)
    '#f97316', // Orange (Fear)
    '#eab308', // Yellow (Neutral)
    '#84cc16', // Lime (Greed)
    '#10b981', // Green (Extreme Greed)
  ];

  const createSegmentPath = (index: number) => {
    // Start angle for this segment
    // Index 0 starts at -180.
    const startAngleDeg = -180 + index * (segmentSpan + gap);
    const endAngleDeg = startAngleDeg + segmentSpan;

    // Convert to Radians
    const startRad = (startAngleDeg * Math.PI) / 180;
    const endRad = (endAngleDeg * Math.PI) / 180;

    const x1 = center.x + radius * Math.cos(startRad);
    const y1 = center.y + radius * Math.sin(startRad);
    const x2 = center.x + radius * Math.cos(endRad);
    const y2 = center.y + radius * Math.sin(endRad);

    // SVG Path Command
    // M startX startY A radius radius 0 largeArcFlag sweepFlag endX endY
    return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
  };

  return (
    <div className="w-full bg-stone-950 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">

      <div className="flex items-center gap-2 mb-4 z-10 w-full justify-center">
        <h3 className="text-white/90 font-bold text-lg">Fear & Greed</h3>
      </div>

      {/* Gauge Container */}
      <div className="relative w-64 h-32 z-10 flex justify-center mb-2">
        <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible">
            {/* Segments */}
            {colors.map((color, i) => (
                <path
                    key={i}
                    d={createSegmentPath(i)}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    className="opacity-90"
                />
            ))}

            {/* Indicator Circle */}
            <motion.circle
                cx={0} // We animate x/y via transform or just animate the values
                cy={0}
                r="8"
                fill="white"
                initial={{ x: center.x - radius, y: center.y }} // Start at left
                animate={{ x: indicatorX, y: indicatorY }}
                transition={{ type: "spring", stiffness: 50, damping: 15 }}
                className="drop-shadow-lg"
                stroke="#1c1917" // match bg for "cutout" effect if needed, or just shadow
                strokeWidth="2"
            />
        </svg>

        {/* Score & Rating Text - Positioned absolutely to center within the semi-circle */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end h-full pb-4 pointer-events-none">
            <div className="text-4xl font-bold font-space text-white tracking-tight leading-none drop-shadow-md">
                {score}
            </div>
            <div className="text-sm text-white/60 font-medium capitalize mt-1">
                {data.rating}
            </div>
        </div>
      </div>

       <div className="text-[10px] text-white/20 mt-[-5px] z-10">
          Updated: {new Date(data.updatedAt).toLocaleDateString()}
       </div>

    </div>
  );
}
