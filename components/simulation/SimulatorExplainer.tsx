'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Activity, BarChart2,
  Sigma, Calculator, ArrowRight,
  RefreshCw, Shuffle, GitBranch, Binary,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimulatorExplainerProps {
  mode?: 'SIMPLE' | 'MONTE_CARLO';
}

const steps = [
  {
    id: 'simple',
    title: 'Deterministic Growth',
    subtitle: 'Compound Interest Model',
    icon: TrendingUp,
    color: 'blue',
    description: 'The Simple Projection uses a deterministic mathematical model based on the standard compound interest formula. It assumes a constant rate of return year over year, making it ideal for baseline expectations but unrealistic for volatility.',
    details: [
      { label: 'Constant Return', text: 'Uses weighted historical average or 6-7%', icon: Calculator },
      { label: 'Regular Contributions', text: 'Assumes monthly deposits invested immediately', icon: ArrowRight },
      { label: 'No Volatility', text: 'Ignores market crashes or corrections', icon: Activity }
    ]
  },
  {
    id: 'monte_carlo',
    title: 'Stochastic Simulation',
    subtitle: 'Geometric Brownian Motion',
    icon: GitBranch,
    color: 'emerald',
    description: 'Monte Carlo simulations model thousands of possible futures by introducing randomness (Brownian Motion) into the price path. It accounts for volatility and correlation between assets to generate a probabilistic "Cone of Uncertainty".',
    details: [
      { label: 'Drift (μ)', text: 'Expected return driving the trend', icon: ArrowRight },
      { label: 'Shock (σ)', text: 'Random volatility component', icon: Shuffle },
      { label: 'Correlations', text: 'Assets move together (Cholesky Matrix)', icon: Binary }
    ]
  }
];

export default function SimulatorExplainer({ mode = 'SIMPLE' }: SimulatorExplainerProps) {
  const [activeStep, setActiveStep] = useState(mode === 'MONTE_CARLO' ? 1 : 0);
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);

  // Sync active step if mode prop changes
  useEffect(() => {
    setActiveStep(mode === 'MONTE_CARLO' ? 1 : 0);
  }, [mode]);

  return (
    <div className="w-full mt-12 mb-8 relative font-sans">
      {/* Ambient Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-blue-500/5 to-purple-500/5 blur-3xl rounded-full opacity-30 pointer-events-none" />

      <div className="relative glass-panel border border-white/10 bg-black/40 backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-8 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <Binary className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Simulation Logic <span className="text-emerald-400">Exposed</span>
              </h2>
            </div>
            <p className="text-neutral-400 max-w-2xl text-sm">
              Understand the mathematical models powering your wealth projections.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-[500px]">

          {/* LEFT: Interactive Visualizer (7 Columns) */}
          <div className="lg:col-span-7 bg-black/20 relative overflow-hidden flex flex-col border-r border-white/10">
             {/* Background Grid */}
             <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10 pointer-events-none" />

             {/* Content Area */}
             <div className="flex-1 p-8 lg:p-12 flex items-center justify-center relative w-full">
               <AnimatePresence mode="wait">

                {/* === STEP 1: DETERMINISTIC (SIMPLE) === */}
                {activeStep === 0 && (
                  <motion.div
                    key="step-0"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.4 }}
                    className="w-full flex flex-col items-center gap-10"
                  >
                    {/* The Formula */}
                    <div className="relative group">
                      <div className="absolute -inset-6 bg-blue-500/10 blur-2xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                      <div className="relative bg-black/80 border border-white/10 px-8 py-6 rounded-2xl shadow-2xl backdrop-blur-md flex flex-wrap justify-center items-center gap-4 text-2xl md:text-3xl font-serif text-white">
                        <span
                          className={cn("transition-colors cursor-help italic font-bold", hoveredTerm === 'A' ? "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" : "text-white")}
                          onMouseEnter={() => setHoveredTerm('A')}
                          onMouseLeave={() => setHoveredTerm(null)}
                        >
                          FV
                        </span>
                        <span className="text-neutral-600 text-xl mx-1">=</span>
                        <div className="flex items-center group/principal">
                           <span
                            className={cn("transition-colors cursor-help italic", hoveredTerm === 'P' ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "text-neutral-200")}
                            onMouseEnter={() => setHoveredTerm('P')}
                            onMouseLeave={() => setHoveredTerm(null)}
                           >
                            P(1+r)
                           </span>
                           <sup className="text-lg text-neutral-400">t</sup>
                        </div>
                        <span className="text-neutral-600 text-xl mx-1">+</span>
                        <div className="flex items-center group/contribution">
                           <span
                            className={cn("transition-colors cursor-help italic", hoveredTerm === 'PMT' ? "text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]" : "text-purple-400")}
                            onMouseEnter={() => setHoveredTerm('PMT')}
                            onMouseLeave={() => setHoveredTerm(null)}
                           >
                            PMT
                           </span>
                           <span className="ml-1 text-neutral-200">×</span>
                           <div className="flex flex-col items-center mx-2 text-lg">
                              <span className="border-b border-white/20 pb-1">(1+r)<sup className="text-xs">t</sup> - 1</span>
                              <span>r</span>
                           </div>
                        </div>
                      </div>

                      {/* Floating Tooltip */}
                      <AnimatePresence>
                        {hoveredTerm && (
                           <motion.div
                             initial={{ opacity: 0, y: 10, x: '-50%' }}
                             animate={{ opacity: 1, y: 0, x: '-50%' }}
                             exit={{ opacity: 0, y: 5, x: '-50%' }}
                             className="absolute top-full left-1/2 mt-6 px-6 py-3 bg-neutral-900/95 border border-white/20 rounded-xl shadow-2xl whitespace-nowrap z-20 backdrop-blur-xl"
                           >
                             <div className="flex flex-col items-center gap-1">
                                <span className="text-sm font-bold text-white tracking-wide uppercase">
                                  {hoveredTerm === 'A' && "Future Value"}
                                  {hoveredTerm === 'P' && "Principal Investment"}
                                  {hoveredTerm === 'PMT' && "Monthly Contribution"}
                                </span>
                                <span className="text-xs text-neutral-400">
                                  {hoveredTerm === 'A' && "Total account balance after t years."}
                                  {hoveredTerm === 'P' && "Starting amount compounded annually."}
                                  {hoveredTerm === 'PMT' && "Regular deposits compounded monthly."}
                                </span>
                             </div>
                             <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-neutral-900/95 border-t border-l border-white/20 rotate-45" />
                           </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Visual Metaphor: Smooth Chart */}
                    <div className="w-full max-w-sm h-40 bg-white/5 border border-white/10 rounded-xl p-6 relative overflow-hidden flex items-end">
                       <div className="absolute top-4 left-4 text-xs text-neutral-400 font-mono">Growth Trajectory</div>
                       <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <path
                            d="M0,100 Q50,60 100,10"
                            fill="none"
                            stroke="#60a5fa"
                            strokeWidth="3"
                          />
                          <path
                            d="M0,100 Q50,60 100,10 L100,100 L0,100 Z"
                            fill="url(#blueGradient)"
                            opacity="0.2"
                          />
                          <defs>
                            <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#60a5fa" />
                              <stop offset="100%" stopColor="transparent" />
                            </linearGradient>
                          </defs>
                       </svg>
                       <div className="absolute bottom-4 right-4 text-xs text-blue-400 font-bold bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                          Predictable
                       </div>
                    </div>
                  </motion.div>
                )}

                {/* === STEP 2: STOCHASTIC (MONTE CARLO) === */}
                {activeStep === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="w-full flex flex-col items-center gap-10"
                  >
                    {/* The Formula */}
                    <div className="relative group">
                        <div className="absolute -inset-6 bg-emerald-500/10 blur-2xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                        <div className="relative bg-black/80 border border-white/10 px-8 py-6 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-4 text-2xl md:text-3xl font-serif text-white">
                            <span className="text-white">dS</span>
                            <span className="text-neutral-600 text-xl mx-1">=</span>
                            <div className="flex items-center group/drift cursor-help">
                                <span className="text-emerald-400">μS dt</span>
                            </div>
                            <span className="text-neutral-600 text-xl mx-1">+</span>
                            <div className="flex items-center group/shock cursor-help">
                                <span className="text-rose-400">σS dW</span>
                            </div>
                        </div>
                        <div className="mt-4 flex gap-4 justify-center text-xs text-neutral-500 font-mono">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /> Drift (Trend)</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-400" /> Random Shock</span>
                        </div>
                    </div>

                    {/* Visual Metaphor: Random Paths */}
                    <div className="w-full max-w-sm h-40 bg-white/5 border border-white/10 rounded-xl p-6 relative overflow-hidden flex items-end">
                       <div className="absolute top-4 left-4 text-xs text-neutral-400 font-mono">100+ Simulations</div>
                       <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {/* Random Paths */}
                          <path d="M0,100 L10,90 L20,95 L30,80 L40,85 L50,70 L60,75 L70,60 L80,65 L90,50 L100,55" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.4" />
                          <path d="M0,100 L10,95 L20,85 L30,90 L40,75 L50,80 L60,65 L70,70 L80,55 L90,60 L100,45" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.4" />
                          <path d="M0,100 L10,98 L20,92 L30,85 L40,90 L50,82 L60,70 L70,75 L80,68 L90,55 L100,40" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.4" />

                          {/* Worst Case */}
                          <path d="M0,100 L20,105 L40,110 L60,100 L80,105 L100,95" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                       </svg>
                       <div className="absolute bottom-4 right-4 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                          Probabilistic
                       </div>
                    </div>
                  </motion.div>
                )}

               </AnimatePresence>
             </div>
          </div>

          {/* RIGHT: Navigation & Details (5 Columns) */}
          <div className="lg:col-span-5 bg-white/[0.02] border-l border-white/10 flex flex-col h-full">
            <div className="flex flex-col gap-0">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = activeStep === index;

                return (
                  <button
                    key={step.id}
                    onClick={() => setActiveStep(index)}
                    className={cn(
                      "group text-left p-6 md:p-8 transition-all duration-300 border-b border-white/5 relative",
                      isActive
                        ? "bg-white/5"
                        : "hover:bg-white/[0.02] opacity-60 hover:opacity-100"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-sim-indicator"
                        className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}

                    <div className="flex gap-4">
                      <div className={cn(
                        "mt-1 p-2.5 rounded-xl h-fit transition-colors border",
                        isActive
                           ? `bg-${step.color}-500/10 text-${step.color}-400 border-${step.color}-500/30`
                           : "bg-white/5 text-neutral-500 border-white/5 group-hover:border-white/10"
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                            <h3 className={cn("font-semibold text-lg", isActive ? "text-white" : "text-neutral-300")}>
                            {step.title}
                            </h3>
                            {isActive && <ChevronRight className="w-4 h-4 text-emerald-500 animate-pulse" />}
                        </div>
                        <p className="text-xs font-mono text-emerald-500/70 mb-2 uppercase tracking-wide">
                            {step.subtitle}
                        </p>
                        <p className="text-sm text-neutral-400 leading-relaxed mb-4">
                          {step.description}
                        </p>

                        <AnimatePresence>
                          {isActive && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="grid gap-3 pt-2">
                                {step.details.map((detail, i) => (
                                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-black/20 border border-white/5">
                                    <detail.icon className="w-4 h-4 text-neutral-500 mt-0.5" />
                                    <div>
                                        <div className="text-xs text-neutral-200 font-medium mb-0.5">{detail.label}</div>
                                        <div className="text-xs text-neutral-500 leading-snug">{detail.text}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
