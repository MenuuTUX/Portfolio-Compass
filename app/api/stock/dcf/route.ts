import { NextRequest, NextResponse } from "next/server";
import { getFilingsSource, SecNotConfiguredError } from "@/lib/fundamentals/live";
import { getFastHistory, getFastQuotes } from "@/lib/fast-market";
import { isTicker, toYahooSymbol } from "@/lib/tickers";
import { CACHE, cacheHeaders, NO_STORE } from "@/lib/http-cache";
import { impliedGrowth, impliedReturn, sensitivity, type DcfInputs } from "@/lib/valuation/dcf";
import { checkReadiness } from "@/lib/valuation/readiness";
import { describeResult, describeReturn, exitMultipleWarning } from "@/lib/valuation/summarize";
import { MARKET_PROXY } from "@/lib/math/beta";
import { olsBeta, simpleReturns, weeklyPairs } from "@/lib/valuation/beta";
import { blumeAdjustBeta } from "@/lib/valuation/wacc";
import type { DcfResponse } from "@/lib/valuation/response";

export const maxDuration = 30;

const FALLBACK_RISK_FREE = 0.042;

const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;

function rowsFor(inputs: DcfInputs, extra: { beta: string; riskFree: string; shares: string }) {
  return [
    { label: "Base revenue", value: `$${(inputs.rev0 / 1e9).toFixed(1)}B`, note: "Last completed fiscal year." },
    { label: "Growth if unchanged", value: pct(inputs.g1), note: "The company's own revenue growth per year over its reported history. The answer above replaces this." },
    { label: "Operating margin", value: pct(inputs.margin0), note: "Last fiscal year's margin, held for every forecast year." },
    { label: "Tax rate", value: pct(inputs.tax), note: "Effective rate, fading to 25% over the forecast." },
    { label: "Return on new capital", value: pct(inputs.ronic), note: "What new investment earns. A higher number means growth needs less reinvestment." },
    { label: "Cost of capital", value: pct(inputs.wacc), note: `Cost of equity from beta ${extra.beta} and a ${extra.riskFree} risk-free rate, blended with the company's cost of debt.` },
    { label: "Terminal growth", value: pct(inputs.gT), note: "Growth after the forecast, capped at the lower of 4% and the risk-free rate." },
    { label: "Net debt", value: `$${(inputs.netClaims / 1e9).toFixed(1)}B`, note: "Debt minus cash and short-term investments, plus finance leases, noncontrolling interest, preferred stock and unfunded pensions after tax. Latest balance sheet." },
    { label: "Shares", value: `${(inputs.shares / 1e9).toFixed(2)}B`, note: extra.shares },
    { label: "Forecast", value: `${inputs.years ?? 10} years`, note: "Mid-year timing, starting with the part of this fiscal year that is left." },
  ];
}

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("ticker") ?? "").trim();
  if (!raw || !isTicker(raw)) {
    return NextResponse.json({ error: "A valid ticker is required" }, { status: 400, headers: NO_STORE });
  }
  const symbol = toYahooSymbol(raw);

  let company;
  try {
    company = (await getFilingsSource().lookup(symbol)).company;
  } catch (error) {
    if (error instanceof SecNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503, headers: NO_STORE });
    }
    console.error("[API] DCF filings lookup failed:", error);
    return NextResponse.json({ error: "Company filings are temporarily unavailable." }, { status: 502, headers: NO_STORE });
  }
  if (!company) {
    const refused: DcfResponse = {
      status: "refused",
      ticker: symbol,
      reasons: ["This ticker does not file with the SEC, so there are no filings to read. Canadian listings and funds are not covered."],
    };
    return NextResponse.json(refused, { headers: cacheHeaders(CACHE.valuation) });
  }

  const [quotes, history] = await Promise.all([
    getFastQuotes([symbol, "^TNX"]),
    getFastHistory([symbol, MARKET_PROXY], "5Y", { adjusted: true }),
  ]);
  const quote = quotes.get(symbol);
  if (!quote || !(quote.price > 0)) {
    return NextResponse.json({ error: "No current price is available for this ticker." }, { status: 502, headers: NO_STORE });
  }

  const warnings: string[] = [];
  const tnx = quotes.get("^TNX")?.price;
  const tnxUsable = tnx !== undefined && tnx > 0.5 && tnx < 15;
  const riskFree = tnxUsable ? tnx / 100 : FALLBACK_RISK_FREE;
  if (!tnxUsable) warnings.push(`The 10-year Treasury yield was unavailable, so ${pct(FALLBACK_RISK_FREE)} is assumed.`);

  const { asset, market } = weeklyPairs(history.get(symbol) ?? [], history.get(MARKET_PROXY) ?? []);
  const estimate = olsBeta(simpleReturns(asset), simpleReturns(market));
  let rawBeta = 1;
  if (estimate) {
    rawBeta = estimate.beta;
    if (estimate.standardError > 0.25) warnings.push(`Beta is a rough estimate (standard error ${estimate.standardError.toFixed(2)}).`);
  } else {
    warnings.push("Not enough price history to estimate beta, so a beta of 1.0 is assumed.");
  }

  const today = new Date().toISOString().slice(0, 10);
  // Market cap over price counts every share class; the quote's own share count can be one class only (Alphabet).
  const impliedShares = quote.marketCap && quote.marketCap > 0 ? quote.marketCap / quote.price : quote.sharesOutstanding;
  const base = { today, price: quote.price, riskFree, rawBeta, currentShares: impliedShares };
  const primary = checkReadiness(company, { ...base, ronicBasis: "history" });
  if (!primary.ok) {
    const refused: DcfResponse = { status: "refused", ticker: symbol, reasons: primary.reasons };
    return NextResponse.json(refused, { headers: cacheHeaders(CACHE.valuation) });
  }
  const neutralReady = checkReadiness(company, { ...base, ronicBasis: "wacc" });
  const neutralInputs = neutralReady.ok ? neutralReady.inputs : primary.inputs;

  const describe = (inputs: DcfInputs) =>
    describeResult({ implied: impliedGrowth(inputs, quote.price), band: sensitivity(inputs, quote.price) }, inputs);

  const headline = describe(primary.inputs);
  const exitWarning = exitMultipleWarning(headline.exitMultiple);
  const body: DcfResponse = {
    status: "ok",
    ticker: symbol,
    name: quote.name ?? null,
    price: quote.price,
    priceAsOf: quote.quoteAsOf ?? null,
    fiscalYearEnd: company.annual[company.annual.length - 1]?.end ?? "",
    inputs: primary.inputs,
    neutralInputs,
    headline,
    neutral: describe(neutralInputs),
    impliedReturn: describeReturn(impliedReturn(primary.inputs, quote.price), primary.inputs.wacc),
    rows: rowsFor(primary.inputs, {
      beta: `${blumeAdjustBeta(rawBeta).toFixed(2)} after adjustment`,
      riskFree: pct(riskFree, 2),
      shares: primary.sources.shares,
    }),
    warnings: [...primary.warnings, ...warnings, ...(exitWarning ? [exitWarning] : [])],
  };
  return NextResponse.json(body, { headers: cacheHeaders(CACHE.valuation) });
}
