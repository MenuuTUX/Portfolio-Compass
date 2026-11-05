/**
 * Banks, insurers, REITs and other financial companies (SIC 6000 to 6799):
 * for them EBITDA, free cash flow and net debt mix operating and financing
 * activity and mean little. Metrics that rely on them are withheld.
 */
export function isFinancialSic(sic: number | null): boolean {
  return sic !== null && sic >= 6000 && sic <= 6799;
}

export const FINANCIAL_SECTOR_NOTE =
  "Financial companies borrow and lend as their business, so cash flow, EBITDA and debt measures are not shown. Return on equity and equity to assets are shown instead.";
