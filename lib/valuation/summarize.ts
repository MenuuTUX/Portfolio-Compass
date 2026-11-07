/**
 * Plain-language strings for a reverse DCF result. Wording rules: no "fair value",
 * "undervalued", "overvalued", "buy", "sell" or "target price", and no em dashes.
 * A result that is not solved, or is outside the displayed range, or whose terminal
 * value share is above 100%, shows no number in its headline.
 */
import { dcfValue, type DcfBase, type DcfErrorCode, type DcfInputs, type GrowthSolve, type ReturnSolve, type Sensitivity } from "./dcf";

/** An implied return outside this range is shown as no number. */
const IMPLIED_RETURN_MIN = 0.02;
const IMPLIED_RETURN_MAX = 0.3;
/** Within this of the cost of capital, the implied return reads "about the same". */
const SAME_RATE_TOLERANCE = 0.005;

export interface ReverseReport {
  implied: GrowthSolve;
  band?: Sensitivity;
}

export interface Described {
  headline: string;
  assumptions: string;
  /** Null when the terminal value share has no number to show. */
  terminalShare: string | null;
  /** Null when no sensitivity band was supplied, or the headline has no number. */
  band: string | null;
  /** Terminal value as multiples of the last forecast year's profit. Null when the terminal value share has no number. */
  exitMultiple: { afterTax: number; operating: number } | null;
}

/** Multiples outside this band make the terminal assumptions look stretched. */
export const EXIT_MULTIPLE_HIGH = 35;
export const EXIT_MULTIPLE_LOW = 6;

export type TerminalTier = "low" | "mid" | "high" | "failure";

/** Growth shown as a number only inside this range. */
export const DISPLAY_GROWTH_MIN = -0.1;
export const DISPLAY_GROWTH_MAX = 0.4;

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const pctWhole = (x: number) => `${Math.round(x * 100)}%`;

export function terminalShareTier(share: number): TerminalTier {
  if (!(share <= 1)) return "failure";
  if (share < 0.6) return "low";
  if (share <= 0.8) return "mid";
  return "high";
}

const INVALID_WORDS: Record<DcfErrorCode | "price", string> = {
  "non-finite": "One of the inputs is missing or not a number.",
  shares: "The share count must be above zero.",
  "wacc-range": "The cost of capital is outside the range this tool supports.",
  "wacc-spread": "The cost of capital is too close to long-term growth for the model to work.",
  invalid: "One of the inputs is out of range.",
  price: "The share price must be above zero.",
};

const FAILURE =
  "The model does not hold together for these inputs: the years after the forecast would have to make up more than all of the value. No number is shown.";

/** One leg of the band, in words unless the growth is solved and in range. */
function legText(r: GrowthSolve): string {
  switch (r.status) {
    case "solved":
      return r.g >= DISPLAY_GROWTH_MIN && r.g <= DISPLAY_GROWTH_MAX
        ? `${pct(r.g)} a year`
        : `outside the range this tool shows`;
    case "multiple":
      return "more than one answer";
    case "price-above-range":
      return "no answer in the tested range";
    case "price-below-range":
      return "every tested rate sits above the price";
    case "invalid":
      return INVALID_WORDS[r.code];
  }
}

export function describeResult(result: ReverseReport, inputs: DcfBase | DcfInputs): Described {
  const assumptions = `Held fixed: margin held at ${pct(inputs.margin0)}, WACC ${pct(inputs.wacc)}, terminal growth ${pct(inputs.gT)}, return on new capital ${pct(inputs.ronic)}.`;
  const { implied } = result;
  const band = result.band
    ? `Cost of capital one point lower: ${legText(result.band.waccMinus1)}. One point higher: ${legText(result.band.waccPlus1)}.`
    : null;

  if (implied.status !== "solved") {
    const headline =
      implied.status === "multiple" ? "More than one growth rate fits this price under these inputs, so no single answer is given."
      : implied.status === "price-above-range" ? "No growth rate in the range this tool tests reaches this price under these inputs, so no answer is given."
      : implied.status === "price-below-range" ? "Every growth rate in the range this tool tests gives a value above this price, so no answer is given."
      : `The model could not give a dependable answer for these inputs. ${INVALID_WORDS[implied.code]}`;
    return { headline, assumptions, terminalShare: null, band: null, exitMultiple: null };
  }

  const g = implied.g;
  const forward = dcfValue({ ...inputs, g1: g } as DcfInputs);
  const share = forward.terminalShare;
  const tier = terminalShareTier(share);
  if (tier === "failure") {
    return { headline: FAILURE, assumptions, terminalShare: null, band: null, exitMultiple: null };
  }

  const exitMultiple =
    forward.terminalMultipleNopat !== null && forward.terminalMultipleEbit !== null
      ? { afterTax: forward.terminalMultipleNopat, operating: forward.terminalMultipleEbit }
      : null;
  const exitSentence = exitMultiple
    ? ` That terminal value equals about ${Math.round(exitMultiple.afterTax)} times that year's operating profit after tax, which you can compare with how similar companies trade.`
    : "";
  const terminalShare =
    (tier === "low" ? `Years after the forecast make up ${pctWhole(share)} of the value.`
    : tier === "mid" ? `Years after the forecast make up ${pctWhole(share)} of the value, a large share, so the answer leans on later years.`
    : `Most of this value comes from years after the forecast: ${pctWhole(share)} of it.`) + exitSentence;

  if (g < DISPLAY_GROWTH_MIN || g > DISPLAY_GROWTH_MAX) {
    return {
      headline: "At this price, the implied revenue growth is outside the range this tool shows, so no number is given.",
      assumptions,
      terminalShare,
      band,
      exitMultiple,
    };
  }

  return {
    headline: `At this price, the model needs revenue growth of ${pct(g)} a year.`,
    assumptions,
    terminalShare,
    band,
    exitMultiple,
  };
}

/**
 * A plain-words warning when the terminal value is far from the multiples of ordinary profit,
 * or null when the multiple is inside the range or not shown.
 */
export function exitMultipleWarning(multiple: Described["exitMultiple"]): string | null {
  if (!multiple) return null;
  const n = Math.round(multiple.afterTax);
  if (n <= EXIT_MULTIPLE_HIGH && n >= EXIT_MULTIPLE_LOW) return null;
  const side = n > EXIT_MULTIPLE_HIGH ? `above the ${EXIT_MULTIPLE_HIGH} times` : `below the ${EXIT_MULTIPLE_LOW} times`;
  return `The terminal assumptions look stretched: the value after the forecast is about ${n} times that year's after-tax operating profit, ${side} this check treats as ordinary.`;
}

/**
 * The discount rate at which the base-case forecast is worth the share price,
 * in words. A cross-check on the growth answer: a rate far above the cost of
 * capital says the price asks for more than the forecast delivers, a rate far
 * below says the opposite. It states a fact about the model, not a verdict.
 */
export function describeReturn(solve: ReturnSolve, wacc: number): string | null {
  if (solve.status !== "solved") return null;
  const r = solve.wacc;
  if (!Number.isFinite(r) || r < IMPLIED_RETURN_MIN || r > IMPLIED_RETURN_MAX) return null;
  const diff = Math.abs(r - wacc);
  const relation = diff < SAME_RATE_TOLERANCE ? "about the same as" : r > wacc ? "above" : "below";
  return `If the base forecast comes true and you pay this price, the yearly return it implies is ${pct(r)}, ${relation} the ${pct(wacc)} cost of capital used here.`;
}
