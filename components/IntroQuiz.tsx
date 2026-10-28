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
      { label: "2 to 5 years", value: 40 },
      { label: "5 to 10 years", value: 70 },
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
      { label: "3 to 6 months of expenses", value: 80 },
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

const PORTFOLIO_TEMPLATES = {
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
} satisfies Record<RiskProfile, LocalPortfolioItem[]>;

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

  const pill =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition-colors duration-[70ms] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass";
  const primary = `${pill} bg-ink text-canvas hover:bg-body-strong`;
  const ghost = `${pill} text-muted hover:text-ink`;

  return (
    <div className="mx-auto w-full max-w-lg p-4 sm:p-6">
      <div className="rounded-2xl bg-surface-card p-6 ring-1 ring-hairline sm:p-8">
        {step === "intro" && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
                A few questions first
              </h2>
              <p className="leading-relaxed text-body">
                Five short questions to load an example allocation. It is not a
                recommendation, and you can edit it or start empty.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={() => setStep("quiz")} className={primary}>
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={skip} className={ghost}>
                Skip
              </button>
            </div>
          </div>
        )}

        {step === "quiz" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex min-h-11 items-center gap-1 rounded-full text-sm text-muted transition-colors duration-[70ms] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <span className="text-xs tabular-nums text-muted">
                {index + 1} of {QUESTIONS.length}
              </span>
              <button
                type="button"
                onClick={skip}
                className="inline-flex min-h-11 items-center rounded-full text-sm text-muted transition-colors duration-[70ms] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass"
              >
                Skip
              </button>
            </div>

            <div
              className="h-0.5 w-full overflow-hidden rounded-full bg-surface-soft"
              role="progressbar"
              aria-label="Quiz progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <div className="h-full bg-ink transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-xl font-semibold tracking-tight text-ink">
                {question.title}
              </h3>
              <p className="text-sm text-body">{question.description}</p>
            </div>

            <div className="divide-y divide-hairline overflow-hidden rounded-xl ring-1 ring-hairline">
              {question.options.map((option) => {
                const selected = answers[question.id] === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => pick(option.value)}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors duration-[70ms] cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-compass ${
                      selected ? "bg-surface-soft text-ink" : "bg-transparent text-body-strong hover:bg-surface-soft"
                    }`}
                  >
                    <span>{option.label}</span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-muted">
                <Check className="h-4 w-4" />
                Example allocation
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
                {result.profile} example
              </h2>
              <p className="text-sm leading-relaxed text-body">
                A simple score picked this preset for study. These US-listed
                funds illustrate a stock/bond mix; the result does not account for
                your full finances, currency, taxes, fees, or need for cash, and
                does not establish a personal fit. Review the holdings and
                overlap before using this example.
              </p>
              {result.profile === "Growth" && (
                <p className="text-sm text-muted">
                  VTI and QQQ have overlapping US large-company holdings, so the
                  two-fund mix is less diversified than the fund count suggests.
                </p>
              )}
            </div>

            <ul className="divide-y divide-hairline overflow-hidden rounded-xl ring-1 ring-hairline">
              {result.suggestedPortfolio.map((item) => (
                <li key={item.ticker} className="flex items-center justify-between px-4 py-3">
                  <span className="font-medium text-ink">{item.ticker}</span>
                  <span className="text-sm tabular-nums text-muted">{item.weight}%</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => onComplete(result)} className={primary}>
                Open portfolio
                <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={skip} className={ghost}>
                Start empty
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
