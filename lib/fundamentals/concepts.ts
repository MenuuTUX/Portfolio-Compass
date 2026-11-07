import type { LineItem } from "./types";

export interface Concept {
  /** Flow items cover a period (income, cash flow); instant items are balances on a date. */
  kind: "flow" | "instant";
  /** Tried in order for each period; companies switch tags over time, so the first that has that period wins. */
  usGaap: string[];
  ifrs: string[];
  /**
   * "largest": several tags can cover the same period with different scope
   * (D&A tags differ by what they include), so take the largest value rather
   * than the first tag that has one.
   */
  pick?: "first" | "largest";
  /**
   * Groups of tags that add up to the item when no single tag above reports it (Microsoft reports
   * depreciation and intangible amortization apart). Each group's facts are added per filing and period,
   * and a period counts only when every tag in the group has a value in that filing.
   */
  sums?: string[][];
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
    // Several tags cover the same period with different scope, so the largest wins. A bare
    // "Depreciation" excludes amortization and is kept only as a last resort.
    usGaap: [
      "DepreciationDepletionAndAmortization",
      "DepreciationAmortizationAndOther",
      "DepreciationAmortizationAndAccretionNet",
      "DepreciationAndAmortization",
      "Depreciation",
    ],
    ifrs: ["DepreciationAndAmortisationExpense", "DepreciationExpense"],
    pick: "largest",
    sums: [["Depreciation", "AmortizationOfIntangibleAssets"]],
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
    usGaap: [
      "MarketableSecuritiesCurrent",
      "ShortTermInvestments",
      "AvailableForSaleSecuritiesDebtSecuritiesCurrent",
      "HeldToMaturitySecuritiesCurrent",
      "TradingSecuritiesCurrent",
    ],
    ifrs: ["CurrentFinancialAssetsAtFairValueThroughOtherComprehensiveIncome", "OtherCurrentFinancialAssets"],
  },
  // Securities held beyond one year (Apple holds tens of billions). Counted as cash-like in the valuation bridge.
  marketableSecuritiesNoncurrent: {
    kind: "instant",
    usGaap: ["MarketableSecuritiesNoncurrent", "AvailableForSaleSecuritiesDebtSecuritiesNoncurrent"],
    ifrs: [],
  },
  // Each item takes the first tag with a value, so a debt instrument is never counted twice within one item.
  debtNoncurrent: {
    kind: "instant",
    usGaap: [
      "LongTermDebtNoncurrent",
      "LongTermDebtAndCapitalLeaseObligations",
      "LongTermLineOfCredit",
    ],
    ifrs: ["NoncurrentPortionOfNoncurrentBondsIssued"],
  },
  // "DebtCurrent" and "ShortTermBorrowings" already include commercial paper; "LongTermDebtCurrent" does not.
  debtCurrent: {
    kind: "instant",
    usGaap: [
      "LongTermDebtCurrent",
      "DebtCurrent",
      "LongTermDebtAndCapitalLeaseObligationsCurrent",
      "ShortTermBorrowings",
      "LongTermLineOfCreditCurrent",
    ],
    ifrs: ["CurrentPortionOfNoncurrentBondsIssued"],
  },
  commercialPaper: { kind: "instant", usGaap: ["CommercialPaper"], ifrs: [] },
  /** Used only when the split above is missing; these tags already include the current portion. */
  debtTotal: {
    kind: "instant",
    usGaap: [
      "LongTermDebt",
      "LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities",
      "DebtLongtermAndShorttermCombinedAmount",
      // Notes and convertible notes are reported gross, current portion included, so they belong with the totals.
      "NotesPayable",
      "ConvertibleNotesPayable",
    ],
    ifrs: [],
  },
  preferredEquity: { kind: "instant", usGaap: ["PreferredStockValue"], ifrs: [] },
  // Preferred stock as a claim ahead of common holders: equity on the balance sheet, or temporary equity when redeemable.
  preferredStock: {
    kind: "instant",
    usGaap: ["PreferredStockValue", "TemporaryEquityCarryingAmountAttributableToParent"],
    ifrs: [],
  },
  // Finance (capital) leases. Operating-lease liabilities are left out: their cost already sits in operating income.
  financeLeaseLiabilityNoncurrent: { kind: "instant", usGaap: ["FinanceLeaseLiabilityNoncurrent"], ifrs: [] },
  financeLeaseLiabilityCurrent: { kind: "instant", usGaap: ["FinanceLeaseLiabilityCurrent"], ifrs: [] },
  minorityInterest: { kind: "instant", usGaap: ["MinorityInterest"], ifrs: ["NoncontrollingInterests"] },
  // Net funded status of defined-benefit plans: negative when a plan is underfunded.
  pensionFundedStatus: { kind: "instant", usGaap: ["DefinedBenefitPlanFundedStatusOfPlan"], ifrs: [] },
  // Noncurrent pension and retiree-health liability, used when no net funded status is reported.
  pensionLiabilityNoncurrent: {
    kind: "instant",
    usGaap: ["PensionAndOtherPostretirementDefinedBenefitPlansLiabilitiesNoncurrent"],
    ifrs: [],
  },
  // Dilution inputs from the share-based pay note: options outstanding, their weighted exercise price, unvested RSUs.
  optionsOutstanding: {
    kind: "instant",
    usGaap: ["ShareBasedCompensationArrangementByShareBasedPaymentAwardOptionsOutstandingNumber"],
    ifrs: [],
  },
  optionsExercisePrice: {
    kind: "instant",
    usGaap: ["ShareBasedCompensationArrangementByShareBasedPaymentAwardOptionsOutstandingWeightedAverageExercisePrice"],
    ifrs: [],
  },
  rsusUnvested: {
    kind: "instant",
    usGaap: ["ShareBasedCompensationArrangementByShareBasedPaymentAwardEquityInstrumentsOtherThanOptionsNonvestedNumber"],
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
  netIncomeToCommon: { kind: "flow", usGaap: ["NetIncomeLossAvailableToCommonStockholdersBasic"], ifrs: [] },
  financeLeasePayments: { kind: "flow", usGaap: ["FinanceLeasePrincipalPayments"], ifrs: [] },
};

export const LINE_ITEMS = Object.keys(CONCEPTS) as LineItem[];

/** Balance-sheet share count, read only when the cover page has no dei total (see periods.ts). */
export const SHARE_COUNT_TAG = "CommonStockSharesOutstanding";

/** Every tag the app reads, per taxonomy, so fixtures and the snapshot can drop the rest. */
export function tagsUsed(): { "us-gaap": string[]; "ifrs-full": string[]; dei: string[] } {
  return {
    "us-gaap": [
      ...new Set([
        ...LINE_ITEMS.flatMap((k) => [...CONCEPTS[k].usGaap, ...(CONCEPTS[k].sums ?? []).flat()]),
        SHARE_COUNT_TAG,
      ]),
    ],
    "ifrs-full": [...new Set(LINE_ITEMS.flatMap((k) => CONCEPTS[k].ifrs))],
    dei: ["EntityCommonStockSharesOutstanding"],
  };
}
