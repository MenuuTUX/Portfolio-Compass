"use client";

import { Fragment, useId, useState } from "react";

/**
 * Hero comparison: three real Canadian ETFs side by side, with a switch that shows
 * what each figure assumes. Figures are a dated snapshot copied by hand from the
 * providers' own fund pages; update CHECKED and every value together.
 *   VEQT: https://www.vanguard.ca/en/product/etf/asset-allocation/9692/vanguard-all-equity-etf-portfolio
 *   XEQT: https://www.blackrock.com/ca/investors/en/products/309480/ishares-core-equity-etf-portfolio
 *   XBB:  https://www.blackrock.com/ca/investors/en/products/239493/ishares-core-canadian-universe-bond-index-etf
 */
const CHECKED = "Nov 18, 2026";

interface Fund {
  ticker: string;
  kind: string;
  provider: string;
  /** Management expense ratio, percent. */
  mer: number;
  /** Distribution yield as the provider reports it, percent. */
  yld: number;
  /** One-year NAV total return to Oct 31, 2026, percent. */
  oneYear: number;
}

const FUNDS: Fund[] = [
  { ticker: "VEQT", kind: "All-equity", provider: "Vanguard", mer: 0.22, yld: 1.25, oneYear: 13.92 },
  { ticker: "XEQT", kind: "All-equity", provider: "iShares", mer: 0.19, yld: 0.91, oneYear: 14.01 },
  { ticker: "XBB", kind: "Canadian bonds", provider: "iShares", mer: 0.1, yld: 3.58, oneYear: -0.41 },
];

const pct = (n: number) => `${n.toFixed(2)}%`;
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}%`;

interface Row {
  label: string;
  value: (f: Fund) => string;
  tone?: (f: Fund) => string;
  assumes: string;
}

const ROWS: Row[] = [
  {
    label: "Fee (MER)",
    value: (f) => pct(f.mer),
    assumes:
      "The management expense ratio from each fund's last financial year, as the provider publishes it. It comes out of the fund's value, not your account.",
  },
  {
    label: "Distribution yield",
    value: (f) => pct(f.yld),
    assumes:
      "Vanguard and iShares work this out differently, so VEQT and XEQT do not compare directly here. VEQT as of Oct 31, 2026; XEQT and XBB as of Nov 16, 2026.",
  },
  {
    label: "1-year return",
    value: (f) => signed(f.oneYear),
    tone: (f) => (f.oneYear >= 0 ? "text-emerald-400" : "text-rose-400"),
    assumes:
      "Total return at net asset value with distributions reinvested, Nov 1, 2025 to Oct 31, 2026. One past year, not a forecast.",
  },
  {
    label: "Priced in",
    value: () => "CAD",
    assumes:
      "All three trade in Canadian dollars on the TSX. The equity funds hold stocks from many countries, so their value still moves with other currencies.",
  },
];

export default function HeroCompare() {
  const [showAssumptions, setShowAssumptions] = useState(false);
  const id = useId();
  const titleId = `${id}-title`;

  return (
    <section
      aria-labelledby={titleId}
      className="ws-panel relative p-5 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.28)] sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div>
          <h2 id={titleId} className="text-base font-semibold text-ink">
            Compare three example funds
          </h2>
          <p className="mt-0.5 text-sm text-muted">No fund is ranked. You decide what matters.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showAssumptions}
          onClick={() => setShowAssumptions((on) => !on)}
          className="-mr-2 inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-full px-2 text-sm font-medium text-ink"
        >
          What does this assume?
          <span className="ws-switch" aria-hidden="true">
            <span />
          </span>
        </button>
      </div>

      <table className="mt-5 w-full table-fixed border-collapse text-left">
        <caption className="sr-only">
          VEQT, XEQT and XBB compared on fee, distribution yield, one-year return and currency.
          {showAssumptions ? " Assumptions are shown under each row." : ""}
        </caption>
        <colgroup>
          <col className="w-[28%] sm:w-[31%]" />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr className="align-bottom">
            <td />
            {FUNDS.map((f) => (
              <th key={f.ticker} scope="col" className="pb-3 pl-2 font-normal sm:pl-3">
                <span className="block text-base font-semibold text-ink">{f.ticker}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">
                  {f.kind}, {f.provider}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <Fragment key={row.label}>
              <tr className="border-t border-hairline">
                <th scope="row" className="py-3 pr-2 text-sm font-medium text-body">
                  {row.label}
                </th>
                {FUNDS.map((f) => (
                  <td
                    key={f.ticker}
                    className={`py-3 pl-2 text-sm font-semibold sm:pl-3 tabular-nums sm:text-base ${row.tone ? row.tone(f) : "text-ink"}`}
                  >
                    {row.value(f)}
                  </td>
                ))}
              </tr>
              <tr aria-hidden={!showAssumptions}>
                <td colSpan={FUNDS.length + 1} className="p-0">
                  <div
                    inert={!showAssumptions}
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      showAssumptions ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="mb-3 rounded-md bg-surface-soft px-3 py-2 text-sm leading-relaxed text-body">
                        {row.assumes}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>

      <p className="mt-2 text-pretty border-t border-hairline pt-3 text-xs leading-relaxed text-muted">
        Figures from vanguard.ca and blackrock.com, checked {CHECKED}. Examples, not recommendations.
      </p>
    </section>
  );
}
