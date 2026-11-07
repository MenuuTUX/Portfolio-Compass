"use client";

import { useState } from "react";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { LocalPortfolioItem } from "@/lib/storage";
import {
  isAgeBand,
  isValidAmount,
  saveRiskProfile,
  scoreRiskProfile,
  type AgeBand,
  type QuizAnswers,
  type RiskProfile,
} from "@/lib/risk-profile";

export type { RiskProfile };

type Currency = "CAD" | "USD";

interface Question {
  id: string;
  title: string;
  description: string;
  /** Scored questions use 0-100 values; the currency, account and age questions use labels. */
  options: { label: string; value: number | string }[];
  /** Amount questions take an optional number instead of options. */
  amount?: boolean;
}

export interface QuizResult {
  score: number;
  profile: RiskProfile;
  suggestedProviders: string[];
  suggestedPortfolio: LocalPortfolioItem[];
  /** Plain-language reasons behind the profile. */
  why: string[];
  isSkipped?: boolean;
  /** Which listing the example funds are in. Not part of the score. */
  currency?: Currency;
  /** The account the user plans to hold this in. Not part of the score. */
  account?: string;
  /** Age band for the projection defaults. Not part of the score. */
  ageBand?: AgeBand;
  /** Savings goal in the chosen currency. Not part of the score. */
  goalAmount?: number;
  /** Monthly amount the user could add, in the chosen currency. Not part of the score. */
  monthlyContribution?: number;
}

interface IntroQuizProps {
  onComplete: (result: QuizResult) => void;
  /** When true the example is never loaded, so the screen says so. */
  hasExistingPortfolio?: boolean;
}

// Only these answers feed scoreRiskProfile; the currency and account answers never do.
const SCORED_IDS = ["horizon", "ouch_test", "knowledge", "liquidity", "goal"] as const;

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
  {
    id: "currency",
    title: "Which currency do you invest in?",
    description: "The example funds are listed in the currency you pick.",
    options: [
      { label: "Canadian dollars", value: "CAD" },
      { label: "US dollars", value: "USD" },
    ],
  },
  {
    id: "account",
    title: "Which account?",
    description: "Where would you hold this money?",
    options: [
      { label: "TFSA or RRSP", value: "TFSA or RRSP" },
      { label: "Non-registered", value: "Non-registered" },
      { label: "Not sure", value: "Not sure" },
    ],
  },
  {
    id: "age",
    title: "How old are you?",
    description: "This only sets the starting time horizon in the projection.",
    options: [
      { label: "Under 30", value: "under-30" },
      { label: "30 to 44", value: "30-44" },
      { label: "45 to 59", value: "45-59" },
      { label: "60 or over", value: "60-plus" },
    ],
  },
  {
    id: "savings_goal",
    title: "Do you have a savings goal in mind?",
    description: "Optional. Leave it empty if you do not have one.",
    options: [],
    amount: true,
  },
  {
    id: "monthly_contribution",
    title: "How much could you add each month?",
    description: "Optional. This only fills in the projection.",
    options: [],
    amount: true,
  },
];

const PORTFOLIO_TEMPLATES = {
  USD: {
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
  },
  CAD: {
    Conservative: [
      { ticker: "XBB.TO", weight: 60, shares: 0 },
      { ticker: "XIC.TO", weight: 40, shares: 0 },
    ],
    Balanced: [
      { ticker: "XIC.TO", weight: 60, shares: 0 },
      { ticker: "XBB.TO", weight: 40, shares: 0 },
    ],
    Growth: [{ ticker: "XEQT.TO", weight: 100, shares: 0 }],
  },
} satisfies Record<Currency, Record<RiskProfile, LocalPortfolioItem[]>>;

function scoredAnswers(answers: Record<string, number | string>): QuizAnswers {
  const scored: QuizAnswers = {};
  for (const id of SCORED_IDS) {
    const value = answers[id];
    if (typeof value === "number") scored[id] = value;
  }
  return scored;
}

const currencyOf = (answers: Record<string, number | string>): Currency => (answers.currency === "CAD" ? "CAD" : "USD");

function buildResult(answers: Record<string, number | string>): QuizResult {
  const { score, profile, why } = scoreRiskProfile(scoredAnswers(answers));
  const currency = currencyOf(answers);
  const account = typeof answers.account === "string" ? answers.account : undefined;
  // Optional answers never reach scoreRiskProfile; they only fill in the projection.
  const ageBand = isAgeBand(answers.age) ? answers.age : undefined;
  const goalAmount = isValidAmount(answers.savings_goal) ? answers.savings_goal : undefined;
  const monthlyContribution = isValidAmount(answers.monthly_contribution)
    ? answers.monthly_contribution
    : undefined;

  return {
    score,
    profile,
    suggestedProviders: [],
    suggestedPortfolio: PORTFOLIO_TEMPLATES[currency][profile],
    why,
    isSkipped: false,
    currency,
    account,
    ageBand,
    goalAmount,
    monthlyContribution,
  };
}

const pill =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition-colors duration-[70ms] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass";
const primary = `${pill} bg-ink text-canvas hover:bg-body-strong`;
const ghost = `${pill} text-muted hover:text-ink`;

/** Optional amount: empty means none. Next needs a valid value or an empty box. */
function AmountStep({
  inputId,
  label,
  initial,
  onNext,
  onSkip,
}: {
  inputId: string;
  label: string;
  initial?: number;
  onNext: (value: number | undefined) => void;
  onSkip: () => void;
}) {
  const [text, setText] = useState(initial === undefined ? "" : String(initial));
  const trimmed = text.trim();
  const parsed = trimmed === "" ? undefined : Number(trimmed);
  const valid = parsed === undefined || isValidAmount(parsed);

  return (
    <div className="space-y-4">
      <label htmlFor={inputId} className="block text-sm text-muted">
        {label}
      </label>
      <input
        id={inputId}
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        value={text}
        aria-invalid={!valid}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-ink focus:border-hairline focus:outline-none"
      />
      {!valid && (
        <p role="alert" className="text-sm text-muted">
          Enter an amount of 0 or more, below 1,000,000,000,000.
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={!valid}
          onClick={() => onNext(parsed)}
          className={`${primary} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={onSkip} className={ghost}>
          Skip this
        </button>
      </div>
    </div>
  );
}

export default function IntroQuiz({ onComplete, hasExistingPortfolio = false }: IntroQuizProps) {
  const [step, setStep] = useState<"intro" | "quiz" | "done">("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  const question = QUESTIONS[index];
  const currency = currencyOf(answers);
  const progress = ((index + (step === "done" ? 1 : 0)) / QUESTIONS.length) * 100;

  const skip = () => {
    onComplete({
      score: 0,
      profile: "Balanced",
      suggestedProviders: [],
      suggestedPortfolio: [],
      why: [],
      isSkipped: true,
    });
  };

  // undefined clears this question's answer, so Skip on an amount drops an earlier entry.
  const pick = (value: number | string | undefined) => {
    const next = { ...answers };
    if (value === undefined) delete next[question.id];
    else next[question.id] = value;
    setAnswers(next);

    if (index < QUESTIONS.length - 1) {
      setIndex((i) => i + 1);
      return;
    }

    const built = buildResult(next);
    // Keys are passed explicitly so a skipped amount clears any earlier one.
    saveRiskProfile({
      profile: built.profile,
      score: built.score,
      ageBand: built.ageBand,
      goalAmount: built.goalAmount,
      monthlyContribution: built.monthlyContribution,
    });
    setResult(built);
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
    <div className="mx-auto w-full max-w-lg p-4 sm:p-6">
      <div className="rounded-2xl bg-surface-card p-6 ring-1 ring-hairline sm:p-8">
        {step === "intro" && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
                A few questions first
              </h2>
              <p className="leading-relaxed text-body">
                Ten short questions to load an example allocation. It is not a
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

            {question.amount ? (
              <AmountStep
                key={question.id}
                inputId={`quiz-${question.id}`}
                label={`Amount (${currency})`}
                initial={typeof answers[question.id] === "number" ? (answers[question.id] as number) : undefined}
                onNext={pick}
                onSkip={() => pick(undefined)}
              />
            ) : (
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
            )}
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
                A simple score picked this preset for study. These{" "}
                {result.currency === "CAD" ? "Canadian-listed" : "US-listed"} funds
                illustrate a stock/bond mix in{" "}
                {result.currency === "CAD" ? "Canadian dollars" : "US dollars"}. They are
                illustrative only. The result does not account for your full
                finances, taxes, fees, or need for cash, and does not establish a
                personal fit. Review the holdings and overlap before using this
                example.
              </p>
              <ul className="space-y-1 text-sm text-body">
                {result.why.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              {hasExistingPortfolio && (
                <p className="text-sm font-medium text-ink">
                  You already have holdings. This example will not replace them.
                </p>
              )}
              {result.currency === "USD" && result.account === "TFSA or RRSP" && (
                <p className="text-sm text-muted">
                  US-listed funds can face US withholding tax on dividends in a TFSA. RRSPs are generally exempt.
                  Check how your account treats it before buying.
                </p>
              )}
              {result.profile === "Growth" && result.currency !== "CAD" && (
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
                {hasExistingPortfolio ? "Keep my portfolio" : "Open portfolio"}
                <ArrowRight className="h-4 w-4" />
              </button>
              {!hasExistingPortfolio && (
                <button type="button" onClick={skip} className={ghost}>
                  Start empty
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
