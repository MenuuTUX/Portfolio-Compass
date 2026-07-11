"use client";

import { useState } from "react";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { LocalPortfolioItem } from "@/lib/storage";

export type RiskProfile = "Conservative" | "Balanced" | "Growth";

interface Question {
  id: string;
  title: string;
  description: string;
  options: { label: string; value: number }[];
}

export interface QuizResult {
  score: number;
  profile: RiskProfile;
  suggestedProviders: string[];
  suggestedPortfolio: LocalPortfolioItem[];
  isSkipped?: boolean;
}

interface IntroQuizProps {
  onComplete: (result: QuizResult) => void;
}

const QUESTIONS: Question[] = [
  {
    id: "horizon",
    title: "Time horizon",
    description: "When do you expect to need this money?",
    options: [
      { label: "Under 2 years", value: 0 },
      { label: "2–5 years", value: 40 },
      { label: "5–10 years", value: 70 },
      { label: "10+ years", value: 100 },
    ],
  },
  {
    id: "ouch_test",
    title: "Market drop",
    description: "If $10,000 fell to $7,000 in a crash, what would you do?",
    options: [
      { label: "Sell everything", value: 0 },
      { label: "Sell some", value: 30 },
      { label: "Hold", value: 60 },
      { label: "Buy more", value: 100 },
    ],
  },
  {
    id: "knowledge",
    title: "Experience",
    description: "How comfortable are you with investing?",
    options: [
      { label: "Beginner", value: 10 },
      { label: "Know the basics", value: 40 },
      { label: "Comfortable", value: 70 },
      { label: "Experienced", value: 100 },
    ],
  },
  {
    id: "liquidity",
    title: "Emergency savings",
    description: "Do you have cash set aside outside this portfolio?",
    options: [
      { label: "No", value: 0 },
      { label: "A little", value: 40 },
      { label: "3–6 months of expenses", value: 80 },
      { label: "Yes, fully covered", value: 100 },
    ],
  },
  {
    id: "goal",
    title: "Priority",
    description: "What matters more to you right now?",
    options: [
      { label: "Protect capital", value: 0 },
      { label: "Balance of both", value: 50 },
      { label: "Grow capital", value: 100 },
    ],
  },
];

const PORTFOLIO_TEMPLATES: Record<RiskProfile, LocalPortfolioItem[]> = {
  Conservative: [
    { ticker: "BND", weight: 60, shares: 0 },
    { ticker: "VTI", weight: 40, shares: 0 },
  ],
  Balanced: [
    { ticker: "VTI", weight: 60, shares: 0 },
    { ticker: "BND", weight: 40, shares: 0 },
  ],
  Growth: [
    { ticker: "VTI", weight: 80, shares: 0 },
    { ticker: "QQQ", weight: 20, shares: 0 },
  ],
};

function buildResult(answers: Record<string, number>): QuizResult {
  const total = Object.values(answers).reduce((a, b) => a + b, 0);
  const score = Math.round(total / QUESTIONS.length);

  let profile: RiskProfile = "Balanced";
  if (score < 40) profile = "Conservative";
  else if (score > 75) profile = "Growth";

  return {
    score,
    profile,
    suggestedProviders: [],
    suggestedPortfolio: PORTFOLIO_TEMPLATES[profile],
    isSkipped: false,
  };
}

export default function IntroQuiz({ onComplete }: IntroQuizProps) {
  const [step, setStep] = useState<"intro" | "quiz" | "done">("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  const question = QUESTIONS[index];
  const progress = ((index + (step === "done" ? 1 : 0)) / QUESTIONS.length) * 100;

  const skip = () => {
    onComplete({
      score: 0,
      profile: "Balanced",
      suggestedProviders: [],
      suggestedPortfolio: [],
      isSkipped: true,
    });
  };

  const pick = (value: number) => {
    const next = { ...answers, [question.id]: value };
    setAnswers(next);

    if (index < QUESTIONS.length - 1) {
      setIndex((i) => i + 1);
      return;
    }

    setResult(buildResult(next));
    setStep("done");
  };

  const goBack = () => {
    if (index === 0) {
      setStep("intro");
      return;
    }
    setIndex((i) => i - 1);
  };

  return (
    <div className="w-full max-w-lg mx-auto p-6 flex flex-col justify-center min-h-[480px]">
      {step === "intro" && (
        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-ink">
              A few questions first
            </h2>
            <p className="text-body leading-relaxed">
              Five short questions to suggest a starting allocation. You can
              change everything later — or skip and start empty.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setStep("quiz")}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={skip}
              className="px-5 py-3 rounded-lg text-muted hover:text-ink transition-colors text-sm"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {step === "quiz" && (
        <div className="space-y-8">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={goBack}
              className="text-sm text-muted hover:text-ink inline-flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <span className="text-xs text-muted tabular-nums">
              {index + 1} / {QUESTIONS.length}
            </span>
            <button
              onClick={skip}
              className="text-sm text-muted hover:text-ink transition-colors"
            >
              Skip
            </button>
          </div>

          <div className="h-1 w-full rounded-full bg-surface-soft overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-display font-bold text-ink">
              {question.title}
            </h3>
            <p className="text-body text-sm">{question.description}</p>
          </div>

          <div className="grid gap-2">
            {question.options.map((option) => {
              const selected = answers[question.id] === option.value;
              return (
                <button
                  key={option.label}
                  onClick={() => pick(option.value)}
                  className={`w-full text-left px-4 py-3.5 rounded-lg border transition-colors ${
                    selected
                      ? "border-emerald-500/50 bg-emerald-500/10 text-ink"
                      : "border-hairline bg-surface-card text-ink hover:border-emerald-500/30 hover:bg-surface-soft"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-emerald-500 text-sm font-medium">
              <Check className="w-4 h-4" />
              Suggested allocation
            </div>
            <h2 className="text-2xl font-display font-bold text-ink">
              {result.profile} starting mix
            </h2>
            <p className="text-body text-sm leading-relaxed">
              Based on your answers. Edit or replace holdings anytime in the
              portfolio tab.
            </p>
          </div>

          <ul className="rounded-lg border border-hairline bg-surface-card divide-y divide-hairline">
            {result.suggestedPortfolio.map((item) => (
              <li
                key={item.ticker}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="font-medium text-ink">{item.ticker}</span>
                <span className="text-sm text-muted tabular-nums">
                  {item.weight}%
                </span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => onComplete(result)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
          >
            Open portfolio
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
