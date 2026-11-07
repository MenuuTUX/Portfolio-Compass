import type { Period } from "@/lib/lab/engine/simulate";

export type RebalanceChoice = "on-change" | Period | "drift";

// Guided lessons for the Lab: short Python strategies written against the
// per-day decide(day) API, each with notes tied to lines of the code and
// one-click tweaks. Everything a lesson needs (dates, benchmark, rebalancing)
// is set here so a run always matches what the code says.

interface LessonNote {
  /** 1-based line the note explains. */
  line: number;
  /** Text that must appear on that line; the note is hidden once the code no longer matches. */
  match: string;
  text: string;
}

interface LessonTweak {
  label: string;
  /** Plain text replacements, applied to every occurrence. */
  edits: [from: string, to: string][];
}

export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  /** Two or three sentences on the idea, no jargon. */
  idea: string;
  code: string;
  notes: LessonNote[];
  tweaks: LessonTweak[];
  start: string;
  benchmark: string;
  rebalance: RebalanceChoice;
}

const REBALANCE_TEXT: Record<RebalanceChoice, string> = {
  "on-change": "trades only when your code changes its mind",
  W: "rebalances weekly",
  M: "rebalances monthly",
  Q: "rebalances quarterly",
  Y: "rebalances every year",
  drift: "rebalances when a weight drifts",
};

/** One line describing the hidden settings a lesson runs with. */
export const setupText = (l: Lesson, cash: number) =>
  `$${cash.toLocaleString("en-US")} from ${l.start.slice(0, 4)} to today, ${REBALANCE_TEXT[l.rebalance]}, compared with ${l.benchmark}.`;

export const LESSONS: Lesson[] = [
  {
    id: "buy-and-hold",
    title: "Buy and hold",
    subtitle: "the baseline everything else is measured against",
    idea: "Put everything in one fund on day one and never touch it. Almost every strategy is judged by whether it beats this.",
    start: "2010-01-01",
    benchmark: "SPY",
    rebalance: "on-change",
    code: `def decide(day):
    # decide() runs once for every trading day in the past.
    # Return the fund you want to hold that day.
    return "SPY"  # SPY is a fund that tracks the S&P 500
`,
    notes: [
      { line: 1, match: "def decide(day)", text: "Your whole strategy is this one function. It runs once per trading day, and day holds that day's prices and nothing from the future." },
      { line: 4, match: 'return "SPY"', text: "Returning a ticker in quotes means: put 100% of the money in it. The first day buys, and after that nothing changes." },
    ],
    tweaks: [{ label: "Try the Nasdaq-100 (QQQ)", edits: [['"SPY"', '"QQQ"']] }],
  },
  {
    id: "split",
    title: "Split your money",
    subtitle: "stocks for growth, bonds for calm",
    idea: "Hold two funds in fixed proportions. Prices drift apart, so the engine trades back to your split once a year.",
    start: "2010-01-01",
    benchmark: "SPY",
    rebalance: "Y",
    code: `def decide(day):
    # A dictionary of weights. They are fractions: 0.6 means 60%.
    # AGG is a fund of US bonds. Anything left over stays in cash.
    return {"SPY": 0.6, "AGG": 0.4}
`,
    notes: [
      { line: 4, match: "return {", text: "Return a dictionary to split the money. The numbers must add up to 1 or less (0.6 + 0.4 = 1)." },
      { line: 4, match: "return {", text: "Rebalancing is set to yearly for this lesson, so each year the engine sells what grew and buys what lagged to get back to 60/40." },
    ],
    tweaks: [
      { label: "More stocks: 80 / 20", edits: [["0.6", "0.8"], ["0.4", "0.2"]] },
      { label: "More bonds: 40 / 60", edits: [["0.6", "0.4"], ["0.4", "0.6"]] },
    ],
  },
  {
    id: "moving-average",
    title: "Follow the trend",
    subtitle: "step aside when prices fall below their average",
    idea: "A moving average is the average price over the last N days. When today's price is under it, the market is trending down, so this rule waits in bonds until it recovers.",
    start: "2010-01-01",
    benchmark: "SPY",
    rebalance: "on-change",
    code: `def decide(day):
    price = day.adj_price("SPY")  # today's closing price, adjusted for splits and dividends
    average = day.average("SPY", 200)  # average of the last 200 days
    if price < average:
        return "AGG"  # below its average: wait in bonds
    return "SPY"  # otherwise stay in stocks
`,
    notes: [
      { line: 3, match: "day.average", text: "The 200-day average needs 200 days of history. Until then it is 'not a number', the check below is False, and the rule just holds SPY." },
      { line: 4, match: "if price < average", text: "This is the rule. An if reads: when this is true, do the indented line under it." },
      { line: 5, match: 'return "AGG"', text: "Switching costs a little (slippage is on by default), so rules that flip often can look worse than they feel." },
    ],
    tweaks: [
      { label: "Faster: 100 days", edits: [["200", "100"]] },
      { label: "Slower: 300 days", edits: [["200", "300"]] },
    ],
  },
  {
    id: "momentum",
    title: "Pick the winner",
    subtitle: "own whatever has been rising fastest",
    idea: "Momentum means recent winners tend to keep winning for a while. Compare two funds over the last six months and hold the stronger one, or bonds if both fell.",
    start: "2010-01-01",
    benchmark: "SPY",
    rebalance: "on-change",
    code: `def decide(day):
    us = day.change("SPY", 126)  # growth over ~6 months (126 trading days)
    world = day.change("EFA", 126)  # EFA holds stocks outside the US
    if us < 0 and world < 0:
        return "AGG"  # both fell: hide in bonds
    if world > us:
        return "EFA"
    return "SPY"
`,
    notes: [
      { line: 2, match: "day.change", text: "change() is growth over the last N days as a fraction: 0.05 means up 5%, -0.1 means down 10%." },
      { line: 4, match: "if us < 0 and world < 0", text: "Both conditions must be true for the bond fallback. This is called an absolute check: do not own something that is falling." },
      { line: 6, match: "if world > us", text: "Whichever fund grew more wins the day. Change the 126 and you change how patient the rule is." },
    ],
    tweaks: [
      { label: "Look back a year", edits: [["126", "252"]] },
      { label: "Emerging markets (EEM) instead of EFA", edits: [['"EFA"', '"EEM"']] },
    ],
  },
  {
    id: "crash-guard",
    title: "Dodge the big drops",
    subtitle: "leave when the market falls too far from its high",
    idea: "A drawdown is how far something has fallen from its highest recent price. This rule leaves stocks once SPY is more than 10% below its one-year high, and returns when it recovers.",
    start: "2010-01-01",
    benchmark: "SPY",
    rebalance: "on-change",
    code: `def decide(day):
    high = day.high("SPY", 252)  # highest close of the last year
    drop = day.adj_price("SPY") / high - 1  # 0 at a new high, negative below it
    if drop < -0.10:
        return "AGG"  # fell more than 10%: wait in bonds
    return "SPY"
`,
    notes: [
      { line: 2, match: "day.high", text: "high() is the highest close over the last N days. 252 trading days is about one year." },
      { line: 3, match: "drop =", text: "Price divided by the high, minus 1, is how far below the high we are. -0.1 means 10% below." },
      { line: 4, match: "if drop < -0.10", text: "Leaving early protects you from a deep fall but can also miss the bounce. Compare the Worst drop in your results." },
    ],
    tweaks: [
      { label: "Wait for a 20% drop", edits: [["-0.10", "-0.20"], ["10%", "20%"]] },
      { label: "Nervous: leave at 5%", edits: [["-0.10", "-0.05"], ["10%", "5%"]] },
    ],
  },
  {
    id: "your-idea",
    title: "Your turn",
    subtitle: "change anything and see what happens",
    idea: "Here is a rule that buys SPY after a sharp fall (the RSI indicator) and otherwise keeps a 50/50 mix. Edit it, or replace it with an idea of your own.",
    start: "2010-01-01",
    benchmark: "SPY",
    rebalance: "on-change",
    code: `def decide(day):
    # rsi() runs from 0 to 100. Under 30 means the price fell fast.
    if day.rsi("SPY") < 30:
        return "SPY"  # buy the dip with everything
    return {"SPY": 0.5, "AGG": 0.5}  # otherwise a calm 50/50
`,
    notes: [
      { line: 3, match: "day.rsi", text: "Other tools: day.adj_price(), day.price(), day.average(), day.change(), day.high(), day.low(). Use any ticker you write in quotes and it is downloaded for you." },
      { line: 5, match: "return {", text: "Return None to sit in cash. Weights that add up to less than 1 leave the rest in cash too." },
    ],
    tweaks: [{ label: "Buy dips sooner (RSI 40)", edits: [["< 30", "< 40"], ["Under 30", "Under 40"]] }],
  },
];

export const lessonById = (id: string | null | undefined) => LESSONS.find((l) => l.id === id) ?? null;

/** Apply a tweak's edits to code; null when none of the text is found (the user changed it). */
export function applyTweak(code: string, tweak: LessonTweak): string | null {
  // One pass over the original text, so a swap like 0.6 <-> 0.4 does not undo itself.
  const to = new Map(tweak.edits);
  const pattern = new RegExp(tweak.edits.map(([from]) => from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  if (!pattern.test(code)) return null;
  return code.replace(pattern, (hit) => to.get(hit) ?? hit);
}

/** Tickers written as quoted uppercase strings: "SPY", 'BRK-B', "XLK". These become the strategy's universe. */
export function extractTickers(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/["']([A-Z]{1,5}(?:[.-][A-Z]{1,2})?)["']/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

/** Notes whose line still holds the text they explain; stale ones are dropped. */
export function liveNotes(lesson: Lesson, code: string): LessonNote[] {
  const lines = code.split("\n");
  return lesson.notes.filter((n) => lines[n.line - 1]?.includes(n.match));
}
