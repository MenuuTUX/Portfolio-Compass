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
  | "dilutedShares";

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
  items: Partial<Record<LineItem, FactValue>>;
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
  sharesOutstanding: { value: number; asOf: string; accn: string } | null;
  filings: Filing[];
  /** Date of the newest filing read. */
  asOf: string;
  source: FilingsSourceId;
}
