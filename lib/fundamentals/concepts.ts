import type { LineItem } from "./types";

export interface Concept {
  /** Flow items cover a period (income, cash flow); instant items are balances on a date. */
  kind: "flow" | "instant";
  /** Tried in order for each period; companies switch tags over time, so the first that has that period wins. */
  usGaap: string[];
  ifrs: string[];
}

export const CONCEPTS: Record<LineItem, Concept> = {
  revenue: {
    kind: "flow",
    usGaap: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "RevenuesNetOfInterestExpense"],
    ifrs: ["Revenue", "RevenueFromContractsWithCustomers"],
  },
  grossProfit: { kind: "flow", usGaap: ["GrossProfit"], ifrs: ["GrossProfit"] },
  operatingIncome: { kind: "flow", usGaap: ["OperatingIncomeLoss"], ifrs: ["ProfitLossFromOperatingActivities"] },
  netIncome: {
    kind: "flow",
    usGaap: ["NetIncomeLoss", "ProfitLoss"],
    ifrs: ["ProfitLossAttributableToOwnersOfParent", "ProfitLoss"],
  },
  pretaxIncome: {
    kind: "flow",
    usGaap: [
      "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
      "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
    ],
    ifrs: ["ProfitLossBeforeTax"],
  },
  incomeTax: { kind: "flow", usGaap: ["IncomeTaxExpenseBenefit"], ifrs: ["IncomeTaxExpenseContinuingOperations"] },
  depreciationAmortization: {
    kind: "flow",
    // "Depreciation" alone is a last resort (Microsoft tags only that), so EBITDA can be slightly understated.
    usGaap: ["DepreciationDepletionAndAmortization", "DepreciationAmortizationAndAccretionNet", "DepreciationAndAmortization", "Depreciation"],
    ifrs: ["DepreciationAndAmortisationExpense", "DepreciationExpense"],
  },
  interestExpense: {
    kind: "flow",
    usGaap: ["InterestExpense", "InterestExpenseNonoperating", "InterestExpenseDebt"],
    ifrs: ["FinanceCosts", "InterestExpense"],
  },
  shareBasedComp: { kind: "flow", usGaap: ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"], ifrs: [] },
  operatingCashFlow: {
    kind: "flow",
    usGaap: ["NetCashProvidedByUsedInOperatingActivities"],
    ifrs: ["CashFlowsFromUsedInOperatingActivities"],
  },
  capex: {
    kind: "flow",
    usGaap: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
    ifrs: ["PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"],
  },
  cash: {
    kind: "instant",
    usGaap: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
    ifrs: ["CashAndCashEquivalents"],
  },
  shortTermInvestments: {
    kind: "instant",
    usGaap: ["MarketableSecuritiesCurrent", "ShortTermInvestments", "AvailableForSaleSecuritiesDebtSecuritiesCurrent"],
    ifrs: ["CurrentFinancialAssetsAtFairValueThroughOtherComprehensiveIncome", "OtherCurrentFinancialAssets"],
  },
  debtNoncurrent: { kind: "instant", usGaap: ["LongTermDebtNoncurrent"], ifrs: ["NoncurrentPortionOfNoncurrentBondsIssued"] },
  debtCurrent: { kind: "instant", usGaap: ["LongTermDebtCurrent", "DebtCurrent"], ifrs: ["CurrentPortionOfNoncurrentBondsIssued"] },
  commercialPaper: { kind: "instant", usGaap: ["CommercialPaper"], ifrs: [] },
  /** Used only when the split above is missing; these tags already include the current portion. */
  debtTotal: {
    kind: "instant",
    usGaap: ["LongTermDebt", "LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities", "DebtLongtermAndShorttermCombinedAmount"],
    ifrs: [],
  },
  equity: { kind: "instant", usGaap: ["StockholdersEquity"], ifrs: ["EquityAttributableToOwnersOfParent", "Equity"] },
  assets: { kind: "instant", usGaap: ["Assets"], ifrs: ["Assets"] },
  receivables: { kind: "instant", usGaap: ["AccountsReceivableNetCurrent"], ifrs: ["TradeAndOtherCurrentReceivables"] },
  dilutedShares: {
    kind: "flow",
    usGaap: ["WeightedAverageNumberOfDilutedSharesOutstanding"],
    ifrs: ["AdjustedWeightedAverageShares"],
  },
};

export const LINE_ITEMS = Object.keys(CONCEPTS) as LineItem[];

/** Every tag the app reads, per taxonomy, so fixtures and the snapshot can drop the rest. */
export function tagsUsed(): { "us-gaap": string[]; "ifrs-full": string[]; dei: string[] } {
  return {
    "us-gaap": [...new Set(LINE_ITEMS.flatMap((k) => CONCEPTS[k].usGaap))],
    "ifrs-full": [...new Set(LINE_ITEMS.flatMap((k) => CONCEPTS[k].ifrs))],
    dei: ["EntityCommonStockSharesOutstanding"],
  };
}
