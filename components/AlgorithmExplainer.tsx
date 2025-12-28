'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, TrendingUp, ShieldCheck, Scale, Info, ArrowRight, Zap, Target, Lock, Calculator, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Biopunk aesthetic constants
const GLOW_EMERALD = 'drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]';
const GLOW_ROSE = 'drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]';
const GLOW_BLUE = 'drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]';

const steps = [
  {
    id: 'objective',
    title: 'The Objective Function',
    subtitle: 'Mathematically maximizing utility',
    icon: Target,
    color: 'emerald',
    description: 'We calculate a "Utility Score" (U) for every possible portfolio configuration. The goal is to maximize this score, which represents the optimal trade-off between expected profit and potential loss.',
    details: [
      { label: 'Returns (μ)', text: 'Historical mean returns projected forward', icon: TrendingUp },
      { label: 'Risk (Σ)', text: 'Covariance matrix defining asset volatility', icon: ShieldCheck },
      { label: 'Aversion (λ)', text: 'User-defined risk tolerance parameter', icon: Lock }
    ]
  },
  {
    id: 'process',
    title: 'Greedy Look-Ahead',
    subtitle: 'Iterative marginal decision making',
    icon: BrainCircuit,
    color: 'blue',
    description: 'Finding the theoretical maximum for integer-constrained portfolios is computationally expensive (NP-Hard). We use a greedy heuristic that simulates buying small batches of shares and picks the one that improves the score the most.',
    details: [
      { label: 'Simulation', text: 'Test adding $100 of each asset', icon: Zap },
      { label: 'Marginal Utility', text: 'Calculate improvement in Portfolio U', icon: Scale },
      { label: 'Selection', text: 'Commit capital to the winner', icon: ArrowRight }
    ]
  },
  {
    id: 'constraint',
    title: 'Real-World Constraints',
    subtitle: 'Practical limitation adherence',
    icon: Lock,
    color: 'rose',
    description: 'Unlike pure Modern Portfolio Theory (MPT) which assumes fractional shares and infinite capital, our algorithm respects market realities.',
    details: [
      { label: 'Integer Shares', text: 'No fractional share assumptions', icon: Target },
      { label: 'Budget', text: 'Strict adherence to available cash', icon: Scale },
      { label: 'Rebalancing', text: 'Optimizes new cash + existing holdings', icon: TrendingUp }
    ]
  }
];

export default function AlgorithmExplainer() {
  const [activeStep, setActiveStep] = useState(0);
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);

  // Interactive State for Step 1
  const [lambda, setLambda] = useState(2.0); // Risk Aversion

  // Interactive State for Step 2
  const [stepSimulation, setStepSimulation] = useState(0); // 0: Start, 1: Calc, 2: Select

  return (
    <div className="w-full max-w-7xl mx-auto mt-12 mb-24 relative font-sans">
      {/* Ambient Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-blue-500/5 to-purple-500/5 blur-3xl rounded-full opacity-30 pointer-events-none" />

      <div className="relative glass-panel border border-white/10 bg-black/40 backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-8 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <BrainCircuit className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Optimization Algorithm <span className="text-emerald-400">Exposed</span>
              </h2>
            </div>
            <p className="text-neutral-400 max-w-2xl text-sm">
              Our Discrete Mean-Variance optimizer uses a greedy look-ahead strategy to build portfolios that mathematically maximize risk-adjusted returns.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
            <Calculator className="w-3 h-3" />
            <span>v2.1.0-beta</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-[500px]">

          {/* LEFT: Interactive Visualizer (7 Columns) */}
          <div className="lg:col-span-7 bg-black/20 relative overflow-hidden flex flex-col">
             {/* Background Grid */}
             <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10 pointer-events-none" />

             {/* Content Area */}
             <div className="flex-1 p-8 lg:p-12 flex items-center justify-center relative">
               <AnimatePresence mode="wait">

                {/* === STEP 1: OBJECTIVE FUNCTION === */}
                {activeStep === 0 && (
                  <motion.div
                    key="step-0"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    transition={{ duration: 0.5 }}
                    className="w-full flex flex-col items-center gap-8"
                  >
                    {/* The Equation */}
                    <div className="relative group">
                      <div className="absolute -inset-4 bg-emerald-500/10 blur-xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                      <div className="relative bg-black/60 border border-white/10 px-8 py-6 rounded-2xl shadow-2xl backdrop-blur-sm flex items-center gap-3 text-2xl md:text-3xl font-serif text-white">
                        <span
                          className={cn("transition-colors cursor-help italic", hoveredTerm === 'U' ? "text-emerald-400" : "text-white")}
                          onMouseEnter={() => setHoveredTerm('U')}
                          onMouseLeave={() => setHoveredTerm(null)}
                        >
                          U
                        </span>
                        <span className="text-neutral-500 text-lg mx-1">=</span>
                        <div className="flex items-center group/return">
                           <span
                            className={cn("transition-colors cursor-help italic", hoveredTerm === 'mu' ? "text-blue-400" : "text-neutral-200")}
                            onMouseEnter={() => setHoveredTerm('mu')}
                            onMouseLeave={() => setHoveredTerm(null)}
                           >
                            w<sup className="text-sm">T</sup>μ
                           </span>
                        </div>
                        <span className="text-neutral-500 text-lg mx-2">-</span>
                        <div className="flex items-center group/risk">
                           <span
                            className={cn("transition-colors cursor-help italic font-bold", hoveredTerm === 'lambda' ? "text-rose-400 scale-110" : "text-rose-400")}
                            onMouseEnter={() => setHoveredTerm('lambda')}
                            onMouseLeave={() => setHoveredTerm(null)}
                           >
                            λ
                           </span>
                           <span
                            className={cn("ml-2 transition-colors cursor-help italic", hoveredTerm === 'sigma' ? "text-amber-400" : "text-neutral-200")}
                            onMouseEnter={() => setHoveredTerm('sigma')}
                            onMouseLeave={() => setHoveredTerm(null)}
                           >
                            w<sup className="text-sm">T</sup>Σw
                           </span>
                        </div>
                      </div>

                      {/* Floating Tooltip */}
                      <AnimatePresence>
                        {hoveredTerm && (
                           <motion.div
                             initial={{ opacity: 0, y: 10 }}
                             animate={{ opacity: 1, y: 0 }}
                             exit={{ opacity: 0, y: 5 }}
                             className="absolute top-full left-1/2 -translate-x-1/2 mt-4 px-4 py-2 bg-neutral-900 border border-white/20 rounded-lg shadow-xl whitespace-nowrap z-20"
                           >
                             <span className="text-sm font-medium text-neutral-300">
                               {hoveredTerm === 'U' && "Total Utility (Score)"}
                               {hoveredTerm === 'mu' && "Expected Portfolio Return"}
                               {hoveredTerm === 'lambda' && "Risk Aversion Parameter"}
                               {hoveredTerm === 'sigma' && "Portfolio Variance (Risk)"}
                             </span>
                           </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Interactive Slider Demo */}
                    <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col gap-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-400">Adjust Risk Aversion (λ)</span>
                        <span className="font-mono text-emerald-400">{lambda.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="10"
                        step="0.5"
                        value={lambda}
                        onChange={(e) => setLambda(parseFloat(e.target.value))}
                        className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />

                      {/* Mini Graph Visual */}
                      <div className="h-24 w-full flex items-end gap-1 relative border-l border-b border-white/20 pt-4">
                         {/* Hypothetical Assets */}
                         <motion.div
                          className="w-1/3 bg-blue-500/50 rounded-t-sm relative group"
                          animate={{ height: `${Math.max(10, 80 - (lambda * 5))}%` }}
                         >
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">Growth</div>
                         </motion.div>
                         <motion.div
                          className="w-1/3 bg-purple-500/50 rounded-t-sm relative group"
                          animate={{ height: `${Math.max(10, 50 - (lambda * 0.5))}%` }}
                         >
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">Balanced</div>
                         </motion.div>
                         <motion.div
                          className="w-1/3 bg-emerald-500/50 rounded-t-sm relative group"
                          animate={{ height: `${Math.max(10, 20 + (lambda * 4))}%` }}
                         >
                             <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">Safe</div>
                         </motion.div>
                      </div>
                      <div className="text-[10px] text-neutral-500 text-center">
                        Higher λ penalizes volatility more heavily
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* === STEP 2: GREEDY LOOK-AHEAD === */}
                {activeStep === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="w-full max-w-md flex flex-col items-center gap-8"
                  >
                    <div className="flex gap-4 items-end h-48 w-full justify-center relative">
                      {/* Candidates */}
                      {['A', 'B', 'C', 'D', 'E'].map((id, i) => {
                        // Pseudo-random "Delta U" for simulation
                        const deltaU = [40, 75, 20, 90, 55][i];
                        const isWinner = i === 3;
                        const isRevealed = stepSimulation >= 1;
                        const isSelected = stepSimulation === 2 && isWinner;

                        return (
                          <div key={id} className="flex flex-col items-center gap-2 w-12">
                             {/* Delta U Bar */}
                             <motion.div
                              initial={{ height: 4 }}
                              animate={{
                                height: isRevealed ? `${deltaU}%` : 4,
                                backgroundColor: isSelected ? '#10b981' : isRevealed ? '#3b82f6' : '#262626'
                              }}
                              className="w-full rounded-t-md relative"
                             >
                               {isRevealed && (
                                 <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-mono text-neutral-400"
                                 >
                                   {deltaU}
                                 </motion.div>
                               )}
                             </motion.div>

                             <div className={cn(
                               "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-colors",
                               isSelected ? "bg-emerald-500 text-black border-emerald-400" : "bg-white/5 border-white/10 text-neutral-500"
                             )}>
                               {id}
                             </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={() => setStepSimulation(s => (s + 1) % 3)}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg transition-colors"
                      >
                         {stepSimulation === 0 && <><Zap className="w-4 h-4"/> Simulate Batch</>}
                         {stepSimulation === 1 && <><Scale className="w-4 h-4"/> Compare Utility</>}
                         {stepSimulation === 2 && <><ArrowRight className="w-4 h-4"/> Reset Step</>}
                      </button>
                    </div>

                    <div className="text-sm text-neutral-400 text-center max-w-xs">
                      {stepSimulation === 0 && "Current Portfolio + $100 of each asset..."}
                      {stepSimulation === 1 && "Calculate ΔU = U(new) - U(current)"}
                      {stepSimulation === 2 && "Asset D provides maximum marginal utility gain. BUY."}
                    </div>
                  </motion.div>
                )}

                {/* === STEP 3: CONSTRAINTS === */}
                {activeStep === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="relative w-full max-w-md flex flex-col items-center gap-8"
                  >
                     <div className="relative w-64 h-64 border-2 border-dashed border-white/10 rounded-xl bg-black/20 p-4 grid grid-cols-4 grid-rows-4 gap-2">
                        {/* Budget Limit Overlay */}
                        <div className="absolute -top-3 -right-3 bg-rose-500/20 border border-rose-500/50 text-rose-400 text-xs px-2 py-1 rounded">
                          Max Budget
                        </div>

                        {/* Squares filling up */}
                        {Array.from({ length: 14 }).map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-emerald-500/20 border border-emerald-500/40 rounded flex items-center justify-center"
                          >
                             <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                          </motion.div>
                        ))}

                        {/* The "Unfit" fractional piece */}
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1, x: [0, 5, -5, 0] }}
                          transition={{ delay: 1, duration: 0.5 }}
                          className="bg-rose-500/10 border border-rose-500/40 rounded flex items-center justify-center relative opacity-50"
                        >
                          <span className="text-[10px] text-rose-400 font-mono">0.5</span>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-full h-px bg-rose-500 rotate-45" />
                          </div>
                        </motion.div>
                     </div>

                     <div className="bg-white/5 border border-white/10 p-4 rounded-xl max-w-sm">
                       <div className="flex items-center gap-2 mb-2">
                         <Target className="w-4 h-4 text-emerald-400" />
                         <span className="text-sm font-semibold text-white">Integer Constraint</span>
                       </div>
                       <div className="font-mono text-xs text-neutral-400 bg-black/40 p-2 rounded mb-2">
                         w_i = (Shares_i × Price_i) / TotalValue<br/>
                         Shares_i ∈ ℤ (Must be whole numbers)
                       </div>
                       <p className="text-xs text-neutral-500">
                         Unlike theoretical models which might suggest buying "3.42 shares", we strictly optimize for integer quantities to ensure the portfolio is actually executable.
                       </p>
                     </div>
                  </motion.div>
                )}
               </AnimatePresence>
             </div>

             {/* Step Indicator dots for mobile */}
             <div className="flex lg:hidden justify-center gap-2 pb-6">
                {steps.map((_, i) => (
                  <div key={i} className={cn("w-2 h-2 rounded-full transition-colors", i === activeStep ? "bg-emerald-500" : "bg-white/20")} />
                ))}
             </div>
          </div>

          {/* RIGHT: Navigation & Details (5 Columns) */}
          <div className="lg:col-span-5 bg-white/[0.02] border-l border-white/10 flex flex-col h-full overflow-y-auto custom-scrollbar">
            <div className="flex flex-col gap-0">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = activeStep === index;

                return (
                  <button
                    key={step.id}
                    onClick={() => {
                       setActiveStep(index);
                       setStepSimulation(0); // Reset simulation state
                    }}
                    className={cn(
                      "group text-left p-6 md:p-8 transition-all duration-300 border-b border-white/5 relative",
                      isActive
                        ? "bg-white/5"
                        : "hover:bg-white/[0.02] opacity-60 hover:opacity-100"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-indicator"
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
