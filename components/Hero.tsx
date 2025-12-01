'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, Leaf, Zap, Cpu, Activity, Sprout } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import BiopunkSlider from './BiopunkSlider';

interface HeroProps {
  onStart: () => void;
}

const textVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.8,
      ease: [0.2, 0.65, 0.3, 0.9] as any,
    },
  }),
};

export default function Hero({ onStart }: HeroProps) {
  const [mounted, setMounted] = useState(false);
  const [growthValue, setGrowthValue] = useState(50);
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const y2 = useTransform(scrollY, [0, 500], [0, -150]);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-stone-950 text-stone-100 font-sans selection:bg-emerald-500/30">

      {/* 1. Organic Background Layer - "The Overgrowth" */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-stone-950 to-stone-950" />
        <div className="absolute inset-0 bg-grid-pattern opacity-20 mask-image-gradient" />

        {/* Floating Spores/Particles */}
        {mounted && [...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-emerald-500/10 rounded-full blur-sm"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              scale: Math.random() * 0.5 + 0.2,
            }}
            animate={{
              y: [null, Math.random() * -50],
              x: [null, Math.random() * 50 - 25],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{
              width: Math.random() * 20 + 5,
              height: Math.random() * 20 + 5,
            }}
          />
        ))}
      </div>

      {/* 2. Main Content Wrapper */}
      <div className="container relative z-10 px-4 mx-auto grid lg:grid-cols-2 gap-12 items-center pt-20">

        {/* Left Column: Text & CTA */}
        <div className="text-left space-y-8">
          <motion.div
            initial="hidden"
            animate="visible"
            custom={0}
            variants={textVariants}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/20 border border-emerald-500/20 text-emerald-400 text-xs font-mono tracking-widest backdrop-blur-md"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            SYSTEM: ONLINE // ORGANIC
          </motion.div>

          <motion.h1
            custom={1}
            variants={textVariants}
            className="text-5xl md:text-7xl font-display font-bold leading-tight"
          >
            Nature <span className="text-stone-600">Reclaims</span> <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-200 to-emerald-500 animate-pulse-slow">
              The Market
            </span>
          </motion.h1>

          <motion.p
            custom={2}
            variants={textVariants}
            className="text-lg text-stone-400 max-w-xl leading-relaxed"
          >
            Abandon the sterile machinery of traditional finance.
            PortfolioCompass merges algorithmic precision with organic growth.
            Watch your wealth evolve like a living ecosystem.
          </motion.p>

          <motion.div
            custom={3}
            variants={textVariants}
            className="flex flex-wrap gap-4"
          >
            <motion.button
              onClick={onStart}
              whileHover={{ scale: 1.05, backgroundColor: '#059669' }} // emerald-600
              whileTap={{ scale: 0.95 }}
              className="group px-8 py-4 rounded-lg bg-emerald-600 text-white font-medium shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] flex items-center gap-2 cursor-pointer relative overflow-hidden"
            >
              <span className="relative z-10">Initiate Symbiosis</span>
              <Leaf className="w-4 h-4 relative z-10 group-hover:rotate-45 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </motion.button>

            <motion.button
              onClick={onStart}
              whileHover={{ scale: 1.05, borderColor: 'rgba(255,255,255,0.2)' }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 rounded-lg bg-stone-900/50 border border-stone-700 text-stone-300 hover:text-white font-medium transition-colors backdrop-blur-md cursor-pointer flex items-center gap-2"
            >
              <Cpu className="w-4 h-4" />
              View Documentation
            </motion.button>
          </motion.div>

          {/* Metrics / Trust Indicators */}
          <motion.div
            custom={4}
            variants={textVariants}
            className="grid grid-cols-3 gap-6 pt-8 border-t border-stone-800/50"
          >
            {[
              { label: 'Live Data', val: '24ms', icon: Zap },
              { label: 'Asset Types', val: 'Hybrid', icon: Sprout },
              { label: 'Security', val: 'Bio-Locked', icon: Activity },
            ].map((item, i) => (
              <div key={i} className="space-y-1">
                <item.icon className="w-5 h-5 text-emerald-500 mb-2" />
                <div className="text-2xl font-display font-bold text-white">{item.val}</div>
                <div className="text-xs text-stone-500 uppercase tracking-wider">{item.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right Column: Interactive Visuals */}
        <div className="relative h-[600px] flex items-center justify-center perspective-[1000px]">

          {/* Background Glow */}
          <motion.div
            style={{ y: y2 }}
            className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent rounded-full blur-3xl"
          />

          {/* The "Artifact" - Glassmorphism Card + Interactive Slider */}
          <motion.div
            style={{ y: y1, rotateX: 5, rotateY: -5 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="relative w-full max-w-md bg-stone-900/80 border border-stone-700/50 backdrop-blur-xl rounded-2xl p-8 shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Decorative Circuit Lines */}
            <svg className="absolute top-0 right-0 w-32 h-32 opacity-20 pointer-events-none" viewBox="0 0 100 100">
              <path d="M100 0 L50 0 L50 50 L0 50" fill="none" stroke="#10b981" strokeWidth="2" />
              <circle cx="50" cy="50" r="3" fill="#10b981" />
            </svg>

            <div className="space-y-6 relative z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-display font-bold text-emerald-100">Growth Simulation</h3>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="h-40 bg-stone-950/50 rounded-lg border border-stone-800/50 p-4 relative overflow-hidden group">
                {/* Simulated Chart */}
                <div className="flex items-end justify-between h-full gap-2 px-2">
                  {[...Array(12)].map((_, i) => {
                    const height = Math.min(100, 20 + i * 5 + (growthValue / 100) * i * 8 + Math.random() * 10);
                    return (
                      <motion.div
                        key={i}
                        className="w-full bg-emerald-500/80 rounded-t-sm"
                        animate={{ height: `${height}%` }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        style={{ opacity: 0.3 + (i / 12) }}
                      />
                    );
                  })}
                </div>
                {/* Overlay Text */}
                <div className="absolute top-2 left-4 text-xs text-stone-500 font-mono">
                  PROJECTION: +{(growthValue * 1.2).toFixed(1)}%
                </div>
              </div>

              <div className="space-y-4">
                <BiopunkSlider
                  label="Time Horizon (Years)"
                  min={1}
                  max={50}
                  defaultValue={10}
                  onChange={(v) => setGrowthValue(v * 2)} // Just for visual feedback
                />

                <BiopunkSlider
                  label="Risk Tolerance (Bio-Metric)"
                  min={1}
                  max={100}
                  defaultValue={65}
                  className="pt-2"
                />
              </div>

              <div className="pt-4 flex gap-3 text-xs text-stone-500 border-t border-stone-800">
                 <span>• Encrypted</span>
                 <span>• Decentralized</span>
                 <span>• Organic</span>
              </div>
            </div>

            {/* Glass Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
          </motion.div>
        </div>

      </div>
    </div>
  );
}
