/** Raw SEC shapes (only the fields this app reads). */
export interface SecFact {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy?: number;
  fp?: string;
  form: string;
  filed: string;
  frame?: string;
}

export interface SecCompanyFacts {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, { label?: string; units: Record<string, SecFact[]> }>>;
}

export interface SecSubmissions {
  cik: string;
  name: string;
  sic: string;
  sicDescription?: string;
  fiscalYearEnd?: string;
  tickers?: string[];
  exchanges?: string[];
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate?: string[];
      form: string[];
      items?: string[];
      primaryDocument?: string[];
    };
  };
}

/** Line items the app extracts from filings. */
export type LineItem =
  | "revenue"
  | "grossProfit"
  | "operatingIncome"
  | "netIncome"
  | "pretaxIncome"
  | "incomeTax"
  | "depreciationAmortization"
  | "interestExpense"
  | "shareBasedComp"
  | "operatingCashFlow"
  | "capex"
  | "cash"
  | "shortTermInvestments"
  | "debtNoncurrent"
  | "debtCurrent"
  | "commercialPaper"
  | "debtTotal"
  | "equity"
  | "assets"
  | "receivables"
  | "dilutedShares"
  | "netIncomeToCommon"
  | "preferredEquity"
  | "financeLeasePayments"
  | "marketableSecuritiesNoncurrent"
  | "financeLeaseLiabilityNoncurrent"
  | "financeLeaseLiabilityCurrent"
  | "minorityInterest"
  | "preferredStock"
  | "pensionFundedStatus"
  | "pensionLiabilityNoncurrent"
  | "optionsOutstanding"
  | "optionsExercisePrice"
  | "rsusUnvested";

/** One reported number, with where it came from. */
export interface FactValue {
  value: number;
  tag: string;
  unit: string;
  accn: string;
  form: string;
  filed: string;
  /** Set when a later filing reported a different value for the same period. */
  restated?: { original: number; originalAccn: string };
}

export interface AnnualPeriod {
  /** Calendar year the fiscal year ends in, which is how companies name it. */
  fiscalYear: number;
  start: string;
  end: string;
  items: Partial<Record<LineItem, FactValue>>;
}

export interface TrailingPeriod {
  /** End date of the latest quarter included. */
  end: string;
  /** "annual" when no quarter after the last fiscal year has been filed yet. */
  basis: "annual" | "ytd";
  /**
   * The one date every balance-sheet item is read on: the newest instant that
   * has total assets or cash. An item missing on this date is missing, never
   * taken from another date.
   */
  balanceSheetDate: string | null;
  /** Balance items the filer reports on other dates but not on balanceSheetDate, so they are absent from items. */
  missingOnBalanceDate: LineItem[];
  items: Partial<Record<LineItem, FactValue>>;
}

/** How old the newest figures are, measured from the newest filing read (so a nightly snapshot stays correct). */
export interface Staleness {
  /** Whole months from the latest annual period end to the newest filing. */
  annualMonths: number | null;
  /** More than 15 months: the annual figures predate a normal filing cycle. */
  annualStale: boolean;
  /** Whole months from the trailing period end to the newest filing. */
  trailingMonths: number | null;
  /** More than 6 months. */
  trailingStale: boolean;
}

export interface Filing {
  form: string;
  filed: string;
  accn: string;
  reportDate?: string;
  /** 8-K item numbers, such as "4.02". */
  items: string[];
  url: string;
}

export type FilingsSourceId = "edgar-live" | "snapshot";

export interface CompanyFilings {
  cik: number;
  ticker: string;
  name: string;
  sic: number | null;
  sicDescription?: string;
  /** MMDD, as the SEC reports it, e.g. "0926". */
  fiscalYearEnd?: string;
  taxonomy: "us-gaap" | "ifrs-full";
  /** Reporting currency of the money figures. */
  currency: string;
  annual: AnnualPeriod[];
  trailing: TrailingPeriod | null;
  /**
   * Cover-page shares, summed over the share classes reported on the latest
   * date. `classes` counts the class entries summed; above 1 the per-share
   * figures are only approximate.
   */
  sharesOutstanding: { value: number; asOf: string; accn: string; classes: number } | null;
  filings: Filing[];
  /** Date of the newest filing read. */
  asOf: string;
  staleness: Staleness;
  source: FilingsSourceId;
}
