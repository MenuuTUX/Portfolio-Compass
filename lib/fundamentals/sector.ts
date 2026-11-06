/**
 * - financial: banks, insurers and brokers. EBITDA, free cash flow and net debt
 *   mix operating and financing activity, so those metrics are withheld.
 * - reit: real estate investment trusts (SIC 6798). Leverage measures still apply.
 * - operating: everything else, including operating real estate (6500-6599),
 *   asset managers (6282) and blank-check companies (6770).
 */
export type CompanyKind = "operating" | "financial" | "reit";

export function kindForSic(sic: number | null): CompanyKind {
  if (sic === null) return "operating";
  if (sic === 6798) return "reit";
  if (sic === 6282 || sic === 6770) return "operating";
  if ((sic >= 6000 && sic <= 6499) || (sic >= 6700 && sic <= 6799)) return "financial";
  return "operating";
}

export function isFinancialSic(sic: number | null): boolean {
  return kindForSic(sic) === "financial";
}

export const FINANCIAL_SECTOR_NOTE =
  "Financial companies borrow and lend as their business, so cash flow, EBITDA and debt measures are not shown. Return on equity and equity to assets are shown instead.";
