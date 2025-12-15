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

  // Semi-circle gauge calculations
  const score = data.score;
  const clampedScore = Math.max(0, Math.min(100, score));
  // Angle: 0 = left (-90 deg visually), 100 = right (90 deg visually)
  const angle = (clampedScore / 100) * 180 - 90;

  // Determine color based on score
  let colorClass = 'text-gray-400';
  if (score < 25) colorClass = 'text-rose-500';      // Extreme Fear
  else if (score < 45) colorClass = 'text-orange-500'; // Fear
  else if (score < 55) colorClass = 'text-yellow-500'; // Neutral
  else if (score < 75) colorClass = 'text-lime-500';   // Greed
  else colorClass = 'text-emerald-500';                // Extreme Greed

  return (
    <div className="w-full bg-stone-950 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
      <h3 className="text-white/60 font-medium mb-6 z-10 text-lg">Fear & Greed Index</h3>

      {/* Gauge Container */}
      <div className="relative w-64 h-32 z-10 flex justify-center">

        <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible">
            {/* Defs for gradient */}
            <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f43f5e" /> {/* Red */}
                    <stop offset="25%" stopColor="#f97316" /> {/* Orange */}
                    <stop offset="50%" stopColor="#eab308" /> {/* Yellow */}
                    <stop offset="75%" stopColor="#84cc16" /> {/* Lime */}
                    <stop offset="100%" stopColor="#10b981" /> {/* Green */}
                </linearGradient>
            </defs>

            {/* Background Arc */}
            <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#333"
                strokeWidth="20"
                strokeLinecap="round"
                className="opacity-50"
            />

            {/* Colored Arc */}
            <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="20"
                strokeLinecap="round"
            />

            {/* Labels 0 and 100 inside the arc ends */}
            <text x="25" y="95" fill="white" fontSize="10" className="opacity-50 font-mono" textAnchor="middle">0</text>
            <text x="175" y="95" fill="white" fontSize="10" className="opacity-50 font-mono" textAnchor="middle">100</text>

            {/* Needle */}
            {/* Pivot at 100, 100 */}
            <motion.g
                initial={{ rotate: -90 }}
                animate={{ rotate: angle }}
                transition={{ type: "spring", stiffness: 50, damping: 15 }}
                style={{ originX: "100px", originY: "100px" }}
            >
                {/* Needle Line */}
                <line x1="100" y1="100" x2="100" y2="30" stroke="white" strokeWidth="4" strokeLinecap="round" />
                {/* Center Pivot Circle */}
                <circle cx="100" cy="100" r="6" fill="white" />
            </motion.g>

            {/* Score Text (Inside Arc) */}
             <text x="100" y="80" textAnchor="middle" className={`text-4xl font-bold font-space fill-current ${colorClass}`} style={{ fontSize: '40px', fontWeight: 'bold' }}>
                {score}
            </text>
        </svg>

      </div>

      {/* Rating and Date */}
      <div className="text-center z-10 mt-[-10px]">
        <div className="text-lg text-white/80 font-medium capitalize">
            {data.rating}
        </div>
        <div className="text-xs text-white/30 mt-1">
            Updated: {new Date(data.updatedAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
