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
  // Angle range: -90 (left/red) to 90 (right/green)
  const score = data.score;
  const clampedScore = Math.max(0, Math.min(100, score));
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
      {/* Background Glow */}
      <div className={`absolute inset-0 opacity-10 blur-3xl ${colorClass.replace('text-', 'bg-')}`} />

      <h3 className="text-white/60 font-medium mb-4 z-10">Fear & Greed Index</h3>

      {/* Gauge Container */}
      <div className="relative w-48 h-24 mb-2 z-10">
        {/* Semi-Circle Gradient Background */}
        <div className="absolute inset-0 w-full h-48 rounded-full border-[12px] border-white/5 border-b-0 overflow-hidden box-border" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)' }}></div>

        <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
            {/* Defs for gradient */}
            <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f43f5e" /> {/* Red */}
                    <stop offset="50%" stopColor="#eab308" /> {/* Yellow */}
                    <stop offset="100%" stopColor="#10b981" /> {/* Green */}
                </linearGradient>
            </defs>

            {/* Background Arc */}
            <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="#333"
                strokeWidth="12"
                strokeLinecap="round"
                className="opacity-30"
            />

            {/* Colored Arc */}
            {/* We want the gradient to be static, so we draw the full arc with gradient stroke */}
            <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="12"
                strokeLinecap="round"
            />

            {/* Needle */}
            <motion.g
                initial={{ rotate: -90 }}
                animate={{ rotate: angle }}
                transition={{ type: "spring", stiffness: 60, damping: 15 }}
                style={{ originX: "50px", originY: "50px" }}
            >
                {/* Needle Shape */}
                <path d="M 50 50 L 50 15" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <circle cx="50" cy="50" r="3" fill="white" />
            </motion.g>
        </svg>

        {/* Min/Max Labels */}
        <div className="absolute bottom-0 left-2 text-[10px] text-white/40 font-mono">0</div>
        <div className="absolute bottom-0 right-2 text-[10px] text-white/40 font-mono">100</div>
      </div>

      {/* Score and Rating */}
      <div className="text-center z-10 mt-[-10px]">
        <div className={`text-4xl font-bold font-space tracking-tight ${colorClass}`}>
            {score}
        </div>
        <div className="text-sm text-white/60 font-medium mt-1">
            {data.rating}
        </div>
        <div className="text-[10px] text-white/20 mt-2">
            Updated: {new Date(data.updatedAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
