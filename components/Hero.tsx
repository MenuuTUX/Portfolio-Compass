'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, Leaf, Zap, Cpu, Activity, Sprout } from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import BiopunkSlider from './BiopunkSlider';

const textVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: "easeOut" as const
    }
  })
};

const titleWords = [
  { text: "fun", font: "font-cursive", color: "text-emerald-400" },
  { text: "stable", font: "font-sans", color: "text-blue-400" },
  { text: "aggressive", font: "font-serif", color: "text-red-400" }
];

export default function Hero({ onStart }: { onStart?: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [marketStatus, setMarketStatus] = useState('OPEN');
  const [titleIndex, setTitleIndex] = useState(0);
  const [riskValue, setRiskValue] = useState(65);
  const [yearsValue, setYearsValue] = useState(10);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 50, damping: 20 });
  const mouseY = useSpring(y, { stiffness: 50, damping: 20 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-7deg", "7deg"]);

  const y1 = useTransform(mouseY, [-0.5, 0.5], [-20, 20]);
  const y2 = useTransform(mouseY, [-0.5, 0.5], [20, -20]);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setTitleIndex((prev) => (prev + 1) % titleWords.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseXFromCenter = e.clientX - rect.left - width / 2;
    const mouseYFromCenter = e.clientY - rect.top - height / 2;
    x.set(mouseXFromCenter / width);
    y.set(mouseYFromCenter / height);
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-stone-950 text-stone-100 font-sans selection:bg-emerald-500/30"
      onMouseMove={handleMouseMove}
    >

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
      <div className="container relative z-10 px-4 mx-auto grid lg:grid-cols-2 gap-12 lg:gap-12 items-center pt-24 pb-12 lg:pt-20 lg:pb-0">

        {/* Left Column: Text & CTA */}
        <div className="text-left space-y-6 lg:space-y-8 pointer-events-none">
          <div className="pointer-events-auto">
            <motion.div
              initial="hidden"
              animate="visible"
              custom={0}
              variants={textVariants}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono tracking-widest backdrop-blur-md ${marketStatus === 'OPEN'
                ? 'bg-emerald-900/20 border-emerald-500/20 text-emerald-400'
                : 'bg-red-900/20 border-red-500/20 text-red-400'
                }`}
            >
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${marketStatus === 'OPEN' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${marketStatus === 'OPEN' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
              </span>
              MARKET: {marketStatus}
            </motion.div>

            <motion.h1
              custom={1}
              variants={textVariants}
              className="text-4xl sm:text-5xl md:text-7xl font-display font-bold leading-tight mt-6"
            >
              Make your <span className="text-stone-600">portfolio</span> <br />
              <div className="h-[1.2em] relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={titleIndex}
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -40, opacity: 0 }}
                    transition={{ duration: 0.5, ease: "backOut" }}
                    className={`block ${titleWords[titleIndex].font} ${titleWords[titleIndex].color}`}
                  >
                    {titleWords[titleIndex].text}
                  </motion.span>
                </AnimatePresence>
              </div>
            </motion.h1>

            <motion.p
              custom={2}
              variants={textVariants}
              className="text-base sm:text-lg text-stone-400 max-w-xl leading-relaxed mt-6"
            >
              Experience professional portfolio management tools.
              PortfolioCompass merges algorithmic precision with sustainable growth strategies.
              Watch your wealth evolve with data-driven clarity.
              <br />
              <span className="text-xs text-stone-500 mt-2 block italic">
                Disclaimer: This is not financial advice.
              </span>
            </motion.p>

            <motion.div
              custom={3}
              variants={textVariants}
              className="flex flex-col sm:flex-row gap-4 mt-8"
            >
              <motion.button
                onClick={onStart}
                whileHover={{ scale: 1.05, backgroundColor: '#059669' }} // emerald-600
                whileTap={{ scale: 0.95 }}
                className="group px-8 py-4 rounded-lg bg-emerald-600 text-white font-medium shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden w-full sm:w-auto"
              >
                <span className="relative z-10">Start Analysis</span>
                <Leaf className="w-4 h-4 relative z-10 group-hover:rotate-45 transition-transform" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </motion.button>

              <motion.button
                onClick={onStart}
                whileHover={{ scale: 1.05, borderColor: 'rgba(255,255,255,0.2)' }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 rounded-lg bg-stone-900/50 border border-stone-700 text-stone-300 hover:text-white font-medium transition-colors backdrop-blur-md cursor-pointer flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Cpu className="w-4 h-4" />
                View Documentation
              </motion.button>
            </motion.div>

            {/* Metrics / Trust Indicators */}
            <motion.div
              custom={4}
              variants={textVariants}
              className="grid grid-cols-3 gap-4 sm:gap-6 pt-8 border-t border-stone-800/50 mt-12"
            >
              {[
                { label: 'Data Updates', val: 'Daily', icon: Zap },
                { label: 'Asset Types', val: 'Hybrid', icon: Sprout },
                { label: 'Privacy', val: 'Local-First', icon: Activity },
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <item.icon className="w-5 h-5 text-emerald-500 mb-2" />
                  <div className="text-xl sm:text-2xl font-display font-bold text-white">{item.val}</div>
                  <div className="text-[10px] sm:text-xs text-stone-500 uppercase tracking-wider">{item.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Right Column: Interactive Visuals */}
        <div className="relative h-[400px] lg:h-[600px] flex items-center justify-center perspective-[1000px] w-full pointer-events-none">

          {/* Background Glow */}
          <motion.div
            style={{ y: y2 }}
            className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent rounded-full blur-3xl"
          />

          {/* The "Artifact" - Glassmorphism Card + Interactive Slider */}
          <motion.div
            style={{
              y: y1,
              rotateX,
              rotateY,
              transformStyle: "preserve-3d"
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="relative w-full max-w-md bg-stone-900/80 border border-stone-700/50 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/50 overflow-hidden mx-auto pointer-events-auto"
          >


            <div className="space-y-6 relative z-10" style={{ transform: "translateZ(30px)" }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-display font-bold text-emerald-100">Growth Simulation</h3>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div
                className="h-32 sm:h-40 bg-stone-950/50 rounded-lg border border-stone-800/50 p-4 relative overflow-hidden group"
                style={{ transform: "translateZ(20px)" }}
              >
                {/* Simulated Chart */}
                <div className="flex items-end justify-between h-full gap-2 px-2">
                  {[...Array(12)].map((_, i) => {
                    // Logic:
                    // Risk (0-100) -> Annual Return Rate (2% to 15%)
                    // Years (1-50) -> Duration

                    const rate = 0.02 + (riskValue / 100) * 0.13; // 2% to 15%
                    const maxYears = yearsValue;
                    const yearForBar = (i / 11) * maxYears;

                    // Compound Interest: (1 + r)^t
                    const growth = Math.pow(1 + rate, yearForBar);

                    // Use Logarithmic scale to handle the wide range of growth (1.02x to 1000x+)
                    // Log10(1) = 0
                    // Log10(1000) = 3
                    const logGrowth = Math.log10(growth);

                    // Normalize against a "Reasonable Max" (e.g., ~316x growth = 2.5 log)
                    // to ensure typical values (2x-20x) are visible.
                    // Using 2.5 allows 100x return to be at 80% height, while 1000x clips at 100%.
                    const maxLogScale = 2.5;

                    const barHeight = 10 + (logGrowth / maxLogScale) * 90;
                    const finalHeight = Math.min(100, barHeight + Math.random() * 2); // Add subtle jitter

                    return (
                      <motion.div
                        key={i}
                        className="w-full bg-emerald-500/80 rounded-t-sm"
                        animate={{ height: `${finalHeight}%` }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        style={{ opacity: 0.3 + (i / 12) }}
                      />
                    );
                  })}
                </div>
                {/* Overlay Text */}
                <div className="absolute top-2 left-4 text-xs text-stone-500 font-mono">
                  PROJECTION: +{((Math.pow(1 + (0.02 + (riskValue / 100) * 0.13), yearsValue) - 1) * 100).toFixed(0)}%
                </div>
              </div>

              <div className="space-y-4" style={{ transform: "translateZ(40px)" }}>
                <BiopunkSlider
                  label="Time Horizon"
                  min={1}
                  max={50}
                  defaultValue={10}
                  unit=" Years"
                  onChange={(v) => setYearsValue(v)}
                />

                <BiopunkSlider
                  label="Risk Tolerance ( volatility )"
                  min={1}
                  max={100}
                  defaultValue={65}
                  className="pt-2"
                  onChange={(v) => setRiskValue(v)}
                />
              </div>

              <div className="pt-4 flex gap-3 text-xs text-stone-500 border-t border-stone-800 flex-wrap" style={{ transform: "translateZ(10px)" }}>
                <span>• Professional</span>
                <span>• Algorithmic</span>
                <span>• Sustainable</span>
              </div>
            </div>

            {/* Glass Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" style={{ transform: "translateZ(50px)" }} />
          </motion.div>
        </div>

      </div>
    </div>
  );
}
