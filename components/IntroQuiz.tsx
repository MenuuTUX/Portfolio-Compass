'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  GraduationCap,
  Wallet,
  Target,
  Sparkles,
  Rocket,
  ShieldCheck,
  Brain,
  Zap,
  Leaf,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PortfolioItem } from '@/types';

// --- Types ---

export type RiskProfile = 'Conservative' | 'Balanced' | 'Growth';

interface Question {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  options: {
    label: string;
    value: number; // Score contribution
    emoji?: string;
  }[];
}

export interface QuizResult {
  score: number; // 0-100
  profile: RiskProfile;
  suggestedProviders: string[];
  suggestedPortfolio: PortfolioItem[];
}

interface IntroQuizProps {
  onComplete: (result: QuizResult) => void;
}

// --- Constants ---

const QUESTIONS: Question[] = [
  {
    id: 'horizon',
    title: "The Horizon",
    description: "When will you need to cash out this investment?",
    icon: Target,
    options: [
      { label: "Less than 2 years", value: 0, emoji: "⏱️" },
      { label: "2 - 5 years", value: 40, emoji: "📅" },
      { label: "5 - 10 years", value: 70, emoji: "🗓️" },
      { label: "10+ years", value: 100, emoji: "🚀" },
    ]
  },
  {
    id: 'ouch_test',
    title: "The 'Ouch' Test",
    description: "If you invested $10,000 and the market crashed, what would you do if it dropped to $7,000?",
    icon: ShieldAlert,
    options: [
      { label: "Sell everything immediately", value: 0, emoji: "😱" },
      { label: "Sell some to cut losses", value: 30, emoji: "😰" },
      { label: "Hold and do nothing", value: 60, emoji: "😐" },
      { label: "Buy more at the discount", value: 100, emoji: "🤑" },
    ]
  },
  {
    id: 'knowledge',
    title: "The Knowledge Check",
    description: "How would you describe your investing experience?",
    icon: GraduationCap,
    options: [
      { label: "I'm a total beginner", value: 10, emoji: "🌱" },
      { label: "I know the basics", value: 40, emoji: "📚" },
      { label: "I understand markets well", value: 70, emoji: "🧠" },
      { label: "I'm an expert / Pro", value: 100, emoji: "🦁" },
    ]
  },
  {
    id: 'liquidity',
    title: "The Cash Need",
    description: "Do you have an emergency fund separate from this investment?",
    icon: Wallet,
    options: [
      { label: "No, this is all I have", value: 0, emoji: "😬" },
      { label: "A little, but might need this", value: 40, emoji: "🤏" },
      { label: "Yes, 3-6 months expenses", value: 80, emoji: "✅" },
      { label: "Yes, I'm fully covered", value: 100, emoji: "🏰" },
    ]
  },
  {
    id: 'goal',
    title: "The Goal",
    description: "What matters more to you right now?",
    icon: TrendingUp,
    options: [
      { label: "Protecting my money (Safety)", value: 0, emoji: "🛡️" },
      { label: "A mix of safety and growth", value: 50, emoji: "⚖️" },
      { label: "Maximizing profit (Growth)", value: 100, emoji: "📈" },
    ]
  }
];

const PORTFOLIO_TEMPLATES: Record<RiskProfile | 'Aggressive', PortfolioItem[]> = {
  Conservative: [
    { ticker: 'BND', weight: 60, shares: 0 },
    { ticker: 'VTI', weight: 40, shares: 0 }
  ],
  Balanced: [
    { ticker: 'VTI', weight: 60, shares: 0 },
    { ticker: 'BND', weight: 40, shares: 0 }
  ],
  Growth: [
    { ticker: 'VTI', weight: 80, shares: 0 },
    { ticker: 'QQQ', weight: 20, shares: 0 }
  ],
  Aggressive: [
    { ticker: 'QQQ', weight: 50, shares: 0 },
    { ticker: 'NVDA', weight: 25, shares: 0 },
    { ticker: 'VGT', weight: 25, shares: 0 }
  ]
};

// --- Component ---

export default function IntroQuiz({ onComplete }: IntroQuizProps) {
  const [step, setStep] = useState<'INTRO' | 'QUIZ' | 'CALCULATING' | 'SUCCESS'>('INTRO');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [direction, setDirection] = useState(1); // 1 for next, -1 for back
  const [finalResult, setFinalResult] = useState<QuizResult | null>(null);

  // -- Handlers --

  const handleStart = () => {
    setStep('QUIZ');
  };

  const handleSkip = () => {
    setStep('CALCULATING');
    // Default to Aggressive/Growth profile for "Diamond Hands"
    calculateResult({}, true);
  };

  const handleAnswer = (value: number) => {
    const currentQ = QUESTIONS[currentQuestionIndex];
    const newAnswers = { ...answers, [currentQ.id]: value };
    setAnswers(newAnswers);

    if (currentQuestionIndex < QUESTIONS.length - 1) {
      setDirection(1);
      setTimeout(() => setCurrentQuestionIndex(prev => prev + 1), 250); // Slight delay for visual feedback
    } else {
      setStep('CALCULATING');
      calculateResult(newAnswers);
    }
  };

  const calculateResult = (finalAnswers: Record<string, number>, isSkipped = false) => {
    // Simulate complex calculation
    setTimeout(() => {
      let profile: RiskProfile = 'Balanced';
      let score = 50;
      let suggestedPortfolio = PORTFOLIO_TEMPLATES['Balanced'];

      if (isSkipped) {
        score = 100;
        profile = 'Growth';
        suggestedPortfolio = PORTFOLIO_TEMPLATES['Aggressive'];
      } else {
         // 1. Calculate Score (Simple Average)
        const totalScore = Object.values(finalAnswers).reduce((a, b) => a + b, 0);
        const averageScore = totalScore / QUESTIONS.length;
        score = Math.round(averageScore);

        // 2. Determine Profile
        if (averageScore < 40) {
            profile = 'Conservative';
            suggestedPortfolio = PORTFOLIO_TEMPLATES['Conservative'];
        } else if (averageScore > 75) {
            profile = 'Growth';
            suggestedPortfolio = PORTFOLIO_TEMPLATES['Growth'];
        } else {
            profile = 'Balanced';
            suggestedPortfolio = PORTFOLIO_TEMPLATES['Balanced'];
        }
      }

      // 3. Determine Provider Suggestion
      const horizonScore = finalAnswers['horizon'] || 0;
      const knowledgeScore = finalAnswers['knowledge'] || 0;
      const isTechHeavy = (score > 60 && horizonScore > 60) || knowledgeScore > 70 || isSkipped;

      const providers = isTechHeavy
        ? ['Wealthsimple', 'Invesco', 'Global X'] // Tech/Modern
        : ['Vanguard', 'BMO', 'iShares']; // Traditional

      setFinalResult({
        score,
        profile,
        suggestedProviders: providers,
        suggestedPortfolio
      });
      setStep('SUCCESS');
    }, 2000); // 2s delay for "calculating" effect
  };

  // -- Render Helpers --

  const currentQ = QUESTIONS[currentQuestionIndex];
  const progress = ((currentQuestionIndex) / QUESTIONS.length) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto min-h-[500px] flex flex-col justify-center relative p-6">

      <AnimatePresence mode="wait">

        {/* --- INTRO SCREEN --- */}
        {step === 'INTRO' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full flex items-center justify-center border border-emerald-500/30 shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]"
            >
              <Sparkles className="w-10 h-10 text-emerald-400" />
            </motion.div>

            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                Let's Find Your North Star
              </h2>
              <p className="text-lg text-stone-400 max-w-md mx-auto leading-relaxed">
                Before we build your portfolio, we need to understand your journey.
                Answer 5 quick questions to unlock your personalized strategy.
              </p>
            </div>

            <div className="flex flex-col gap-4 items-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStart}
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)] hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.7)]"
              >
                <span>Start Analysis</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                onClick={handleSkip}
                className="text-stone-500 text-sm hover:text-emerald-400 transition-colors flex items-center gap-2"
              >
                Skip for now (I got diamond hands 💎)
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* --- QUIZ SCREEN --- */}
        {step === 'QUIZ' && (
          <motion.div
            key="quiz"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full relative"
          >
             {/* Persistent Skip Button */}
             <div className="absolute -top-10 right-0">
                <button
                    onClick={handleSkip}
                    className="text-xs text-stone-500 hover:text-emerald-400 transition-colors flex items-center gap-1"
                >
                    <span>Skip (Diamond Hands)</span>
                    <ArrowRight className="w-3 h-3" />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-stone-800 rounded-full mb-8 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentQ.id}
                custom={direction}
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                {/* Question Header */}
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center p-3 rounded-xl bg-stone-800/50 border border-stone-700 text-emerald-400 mb-2">
                    <currentQ.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-3xl font-display font-bold text-stone-100">
                    {currentQ.title}
                  </h3>
                  <p className="text-stone-400 text-lg">
                    {currentQ.description}
                  </p>
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentQ.options.map((option, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.02, backgroundColor: "rgba(16, 185, 129, 0.05)", borderColor: "rgba(16, 185, 129, 0.4)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAnswer(option.value)}
                      className="flex flex-col items-center justify-center p-6 rounded-2xl border border-stone-800 bg-stone-900/40 text-center transition-colors group h-full w-full"
                    >
                      <span className="text-4xl mb-3 filter grayscale group-hover:grayscale-0 transition-all duration-300">
                        {option.emoji}
                      </span>
                      <span className="text-lg font-medium text-stone-300 group-hover:text-emerald-300 transition-colors">
                        {option.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="text-center mt-8 text-stone-600 text-sm font-mono">
              Question {currentQuestionIndex + 1} of {QUESTIONS.length}
            </div>
          </motion.div>
        )}

        {/* --- CALCULATING STATE --- */}
        {step === 'CALCULATING' && (
          <motion.div
            key="calculating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center text-center space-y-8"
          >
            <div className="relative">
              {/* Spinner Rings */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                className="w-32 h-32 rounded-full border-2 border-stone-800 border-t-emerald-500 border-r-transparent"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="absolute inset-2 rounded-full border-2 border-stone-800 border-b-cyan-500 border-l-transparent"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Brain className="w-8 h-8 text-stone-500 animate-pulse" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-display font-bold text-stone-200">
                Analyzing Your DNA
              </h3>
              <p className="text-stone-500 animate-pulse">
                Constructing optimal asset allocation...
              </p>
            </div>
          </motion.div>
        )}

        {/* --- SUCCESS STATE --- */}
        {step === 'SUCCESS' && finalResult && (
           <motion.div
             key="success"
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             className="text-center space-y-8"
           >
              <div className="w-24 h-24 mx-auto bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                 <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>

              <div className="space-y-4">
                 <h2 className="text-3xl md:text-4xl font-display font-bold text-white">
                    We've Built Your Portfolio
                 </h2>
                 <p className="text-lg text-stone-400 max-w-md mx-auto">
                    Based on your <strong>{finalResult.profile}</strong> profile (Score: {finalResult.score}/100),
                    we've allocated a starting strategy for you.
                 </p>
              </div>

              {/* Mini Portfolio Preview */}
              <div className="bg-stone-900/50 rounded-xl border border-stone-800 p-4 max-w-sm mx-auto">
                 <h4 className="text-xs text-stone-500 font-mono uppercase tracking-widest mb-3 text-left pl-2">Allocation</h4>
                 <div className="space-y-2">
                    {finalResult.suggestedPortfolio.map((item) => (
                       <div key={item.ticker} className="flex items-center justify-between p-2 rounded bg-stone-950/50">
                          <span className="font-bold text-stone-200">{item.ticker}</span>
                          <span className="text-emerald-400 font-mono">{item.weight}%</span>
                       </div>
                    ))}
                 </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onComplete(finalResult)}
                className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20"
              >
                Go to Dashboard
                <ArrowRight className="w-5 h-5" />
              </motion.button>
           </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
