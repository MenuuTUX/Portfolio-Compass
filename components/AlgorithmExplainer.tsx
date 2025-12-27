'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, TrendingUp, ShieldCheck, Scale, Info, ArrowRight, Zap, Target, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

// Biopunk aesthetic constants
const GLOW_EMERALD = 'drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]';
const GLOW_ROSE = 'drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]';
const GLOW_BLUE = 'drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]';

const steps = [
  {
    id: 'objective',
    title: 'The Objective Function',
    icon: Target,
    color: 'emerald',
    description: 'We maximize utility (U) by balancing expected returns against portfolio risk.',
    formula: 'U = w^T\\mu - \\lambda w^T \\Sigma w',
    details: [
      { label: 'Returns (μ)', text: 'Historical mean returns projected forward', icon: TrendingUp },
      { label: 'Risk (Σ)', text: 'Covariance matrix defining asset volatility', icon: ShieldCheck },
      { label: 'Aversion (λ)', text: 'User-defined risk tolerance parameter', icon: Lock }
    ]
  },
  {
    id: 'process',
    title: 'Greedy Look-Ahead',
    icon: BrainCircuit,
    color: 'blue',
    description: 'Instead of finding a theoretical optimum, we simulate buying "batches" of shares.',
    formula: 'Step \\approx $100',
    details: [
      { label: 'Simulation', text: 'Test adding $100 of each asset', icon: Zap },
      { label: 'Marginal Utility', text: 'Calculate improvement in Portfolio U', icon: Scale },
      { label: 'Selection', text: 'Commit capital to the winner', icon: ArrowRight }
    ]
  },
  {
    id: 'constraint',
    title: 'Real-World Constraints',
    icon: Lock,
    color: 'rose',
    description: 'The algorithm respects integer share counts and budget limits, unlike pure MPT.',
    formula: 'Shares \\in \\mathbb{Z}^+',
    details: [
      { label: 'Integer Shares', text: 'No fractional share assumptions', icon: Target },
      { label: 'Budget', text: 'Strict adherence to available cash', icon: Scale },
      { label: 'Rebalancing', text: 'Optimizes new cash + existing holdings', icon: TrendingUp }
    ]
  }
];

export default function AlgorithmExplainer() {
  const [activeStep, setActiveStep] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="w-full max-w-7xl mx-auto mt-12 mb-24 relative">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-blue-500/5 to-purple-500/5 blur-3xl rounded-full opacity-30 pointer-events-none" />

      <div className="relative glass-panel border border-white/10 bg-black/40 backdrop-blur-md rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <BrainCircuit className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Optimization Algorithm <span className="text-emerald-400">Exposed</span>
            </h2>
          </div>
          <p className="text-neutral-400 max-w-2xl">
            Our Discrete Mean-Variance optimizer uses a greedy look-ahead strategy to build portfolios that mathematically maximize risk-adjusted returns while respecting real-world trading constraints.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Interactive Visualizer */}
          <div className="p-8 lg:p-12 flex flex-col items-center justify-center bg-black/20 min-h-[400px] relative overflow-hidden">
             {/* Background Grid */}
             <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

             <AnimatePresence mode="wait">
              {activeStep === 0 && (
                <motion.div
                  key="step-0"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="relative w-full max-w-md aspect-square flex items-center justify-center"
                >
                  {/* Central Node (Portfolio) */}
                  <motion.div
                    className="w-24 h-24 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center relative z-10 backdrop-blur-sm"
                    animate={{ boxShadow: ['0 0 20px rgba(16,185,129,0.2)', '0 0 40px rgba(16,185,129,0.4)', '0 0 20px rgba(16,185,129,0.2)'] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Target className="w-10 h-10 text-emerald-400" />
                  </motion.div>

                  {/* Orbiting Elements (Assets) */}
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      className="absolute w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
                      animate={{
                        rotate: 360,
                        x: [80, 120, 80], // Elliptical orbit
                        y: [0, 80, 0]
                      }}
                      style={{ rotate: i * 90 }} // Start positions
                      transition={{
                        rotate: { duration: 10 + i * 2, repeat: Infinity, ease: "linear" },
                        x: { duration: 5, repeat: Infinity, ease: "easeInOut" }
                      }}
                    >
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                    </motion.div>
                  ))}

                  {/* Equation Overlay */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-full border border-white/10 text-emerald-400 font-mono text-sm">
                    Max(Return - Risk)
                  </div>
                </motion.div>
              )}

              {activeStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full max-w-md flex flex-col items-center gap-6"
                >
                  <div className="flex gap-4 items-end h-40">
                    {[30, 60, 45, 80, 20].map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: i * 0.1, type: 'spring' }}
                        className={cn(
                          "w-12 rounded-t-md relative group cursor-pointer transition-all hover:opacity-100",
                          i === 3 ? "bg-emerald-500 opacity-100 shadow-[0_0_20px_rgba(16,185,129,0.4)]" : "bg-white/10 opacity-50 hover:bg-white/20"
                        )}
                      >
                        {i === 3 && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute -top-10 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-xs font-bold px-2 py-1 rounded"
                          >
                            +MU
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-neutral-400 text-sm">
                    <Zap className="w-4 h-4 text-yellow-400" /> Simulating next $100 allocation...
                  </div>
                </motion.div>
              )}

              {activeStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="relative w-full max-w-md aspect-square flex items-center justify-center"
                >
                   <div className="grid grid-cols-4 gap-2">
                     {Array.from({ length: 16 }).map((_, i) => (
                       <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className={cn(
                          "w-12 h-12 rounded border flex items-center justify-center text-xs font-mono",
                          i % 3 === 0 ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-white/5 text-neutral-600"
                        )}
                       >
                         {i % 3 === 0 ? "1" : "0"}
                       </motion.div>
                     ))}
                   </div>
                   <div className="absolute inset-0 border-2 border-dashed border-rose-500/30 rounded-xl pointer-events-none" />
                   <div className="absolute -bottom-8 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-1 rounded text-xs">
                     Budget Constraint: $10,000
                   </div>
                </motion.div>
              )}
             </AnimatePresence>
          </div>

          {/* Controls & Explanation */}
          <div className="p-8 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-white/10 bg-white/[0.02]">
            <div className="flex flex-col gap-6">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = activeStep === index;

                return (
                  <button
                    key={step.id}
                    onClick={() => setActiveStep(index)}
                    className={cn(
                      "group text-left p-4 rounded-xl transition-all duration-300 border relative overflow-hidden",
                      isActive
                        ? "bg-white/5 border-white/20 shadow-lg"
                        : "hover:bg-white/5 border-transparent hover:border-white/10 opacity-60 hover:opacity-100"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-glow"
                        className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-50"
                        initial={false}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}

                    <div className="relative z-10 flex gap-4">
                      <div className={cn(
                        "mt-1 p-2 rounded-lg h-fit transition-colors",
                        isActive ? `bg-${step.color}-500/20 text-${step.color}-400` : "bg-white/5 text-neutral-500"
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="flex-1">
                        <h3 className={cn("font-semibold mb-1", isActive ? "text-white" : "text-neutral-300")}>
                          {step.title}
                        </h3>
                        <p className="text-sm text-neutral-400 leading-relaxed mb-3">
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
                              <div className="pt-2 border-t border-white/10 mt-2">
                                <code className="block bg-black/30 p-2 rounded text-xs font-mono text-emerald-400 mb-3">
                                  {step.formula}
                                </code>
                                <div className="grid gap-2">
                                  {step.details.map((detail, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-neutral-400">
                                      <detail.icon className="w-3 h-3 text-neutral-500" />
                                      <span className="text-neutral-300 font-medium">{detail.label}:</span>
                                      <span>{detail.text}</span>
                                    </div>
                                  ))}
                                </div>
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
