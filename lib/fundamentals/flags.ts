import { accnUrl } from "./periods";
import { kindForSic } from "./sector";
import { liquidAssets, splitAdjustedShares, totalDebt } from "./metrics";
import type { CompanyFilings, Filing, LineItem } from "./types";
import { DAY_MS, YEAR_DAYS } from "@/lib/dates";

/** Something to look at, stated as fact, with the rule that raised it and where to read more. No score. */
interface Flag {
  id: string;
  title: string;
  detail: string;
  /** The rule, stated plainly, so the reader can judge it. */
  rule: string;
  filing?: { form: string; filed: string; url: string };
}

/** Every threshold the checks use. The rule text in FLAG_CHECKS and the flag details are built from these numbers. */
export const FLAG_RULES = {
  /** Filing-list checks look back this many years from the as-of date. */
  filingWindowYears: 3,
  /** A figure changed in a later filing by more than this share of its first value. */
  restatementMinChange: 0.05,
  /** Receivables growth must exceed this multiple of revenue growth ... */
  receivablesToRevenueGrowth: 1.5,
  /** ... and this growth rate, so small moves are ignored. */
  receivablesMinGrowth: 0.02,
  /** Diluted shares, compound growth a year over three years. */
  dilutionMaxPerYear: 0.03,
  shareBasedPayMaxShareOfRevenue: 0.1,
  cashBurnLookbackYears: 5,
  cashBurnMinYears: 3,
  netDebtMaxMultipleOfEbitda: 4,
  interestCoverageMin: 2,
} as const;

/** Every check this module runs, so the UI can list what was checked when nothing is raised. */
export const FLAG_CHECKS: { id: string; rule: string }[] = [
  { id: "non-reliance", rule: `An 8-K under Item 4.02 in the last ${FLAG_RULES.filingWindowYears} years` },
  { id: "auditor-change", rule: `An 8-K under Item 4.01 in the last ${FLAG_RULES.filingWindowYears} years` },
  { id: "late-filing", rule: `A late-filing notice (NT 10-K or NT 10-Q) in the last ${FLAG_RULES.filingWindowYears} years` },
  { id: "restated", rule: `A revenue, profit, or operating cash flow figure changed by more than ${FLAG_RULES.restatementMinChange * 100}% in a later filing, for one of the last ${FLAG_RULES.filingWindowYears} years` },
  { id: "receivables", rule: `Receivables grew more than ${FLAG_RULES.receivablesToRevenueGrowth} times as fast as revenue in each of the last two years` },
  { id: "dilution", rule: `Diluted shares grew more than ${FLAG_RULES.dilutionMaxPerYear * 100}% a year over three years` },
  { id: "share-based-pay", rule: `Share-based pay above ${FLAG_RULES.shareBasedPayMaxShareOfRevenue * 100}% of revenue` },
  { id: "cash-burn", rule: `Negative free cash flow in ${FLAG_RULES.cashBurnMinYears} of the last ${FLAG_RULES.cashBurnLookbackYears} years while net income was positive` },
  { id: "leverage", rule: `Net debt above ${FLAG_RULES.netDebtMaxMultipleOfEbitda} times EBITDA, or operating income below ${FLAG_RULES.interestCoverageMin} times interest; checked only for companies with positive EBITDA and net debt` },
];

const ruleOf = (id: string) => FLAG_CHECKS.find((r) => r.id === id)!.rule;
const WINDOW_MS = FLAG_RULES.filingWindowYears * YEAR_DAYS * DAY_MS;
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

export function computeFlags(c: CompanyFilings): Flag[] {
  const flags: Flag[] = [];
  const cutoff = Date.parse(c.asOf) - WINDOW_MS;
  const recent = c.filings.filter((f) => Date.parse(f.filed) >= cutoff);
  const nonReliance8K = recent.find((f) => f.form.startsWith("8-K") && f.items.includes("4.02"));

  const fromFiling = (id: string, title: string, detail: string, hit: Filing | undefined) => {
    if (hit) flags.push({ id, title, detail, rule: ruleOf(id), filing: { form: hit.form, filed: hit.filed, url: hit.url } });
  };
  fromFiling("non-reliance", "8-K Item 4.02: earlier statements should not be relied on",
    "The company stated that previously issued financial statements should no longer be relied on.", nonReliance8K);
  fromFiling("auditor-change", "8-K Item 4.01: change in accountant",
    "The company reported a change in its independent accountant.",
    recent.find((f) => f.form.startsWith("8-K") && f.items.includes("4.01")));
  fromFiling("late-filing", "Notice of late filing",
    "The company filed notice that it could not file a periodic report on time.",
    recent.find((f) => f.form === "NT 10-K" || f.form === "NT 10-Q"));

  const years = c.annual;
  const lastThree = years.slice(-3);
  const moneyItems: LineItem[] = ["revenue", "netIncome", "operatingIncome", "operatingCashFlow"];
  for (const p of [...lastThree].reverse()) {
    const item = moneyItems.find((i) => {
      const fact = p.items[i];
      if (!fact?.restated) return false;
      const base = Math.max(Math.abs(fact.restated.original), 1);
      return Math.abs(fact.value - fact.restated.original) / base > FLAG_RULES.restatementMinChange;
    });
    if (item) {
      const fact = p.items[item]!;
      const possible = nonReliance8K
        ? " Possible restatement: an 8-K under Item 4.02 was filed in the same window."
        : "";
      flags.push({
        id: "restated",
        title: `Fiscal ${p.fiscalYear} figures were changed in a later filing`,
        detail: `${label(item)} was first reported as ${fmt(fact.restated!.original)} and later as ${fmt(fact.value)}.${possible}`,
        rule: ruleOf("restated"),
        filing: { form: fact.form, filed: fact.filed, url: accnUrl(c.cik, fact.accn) },
      });
      break;
    }
  }

  const growth = (a: number | undefined, b: number | undefined) => (a && b && a > 0 ? b / a - 1 : undefined);
  const lastN = years.slice(-3);
  if (lastN.length === 3) {
    const pairs = [[lastN[0], lastN[1]], [lastN[1], lastN[2]]].map(([a, b]) => ({
      rev: growth(a.items.revenue?.value, b.items.revenue?.value),
      rec: growth(a.items.receivables?.value, b.items.receivables?.value),
    }));
    const flagged = pairs.every(({ rev, rec }) => rev !== undefined && rec !== undefined &&
      rec > FLAG_RULES.receivablesMinGrowth && rec > FLAG_RULES.receivablesToRevenueGrowth * Math.max(rev, 0));
    if (flagged) {
      flags.push({
        id: "receivables",
        title: "Receivables grew faster than revenue",
        detail: `Receivables grew ${pairs.map((p) => pct(p.rec!)).join(" and ")} while revenue grew ${pairs.map((p) => pct(p.rev!)).join(" and ")}.`,
        rule: ruleOf("receivables"),
      });
    }
  }

  const shares = splitAdjustedShares(years);
  const sNow = shares[shares.length - 1];
  const sThen = shares[shares.length - 4];
  if (sNow && sThen && years.length >= 4) {
    const span = years[years.length - 1].fiscalYear - years[years.length - 4].fiscalYear;
    const perYear = Math.pow(sNow / sThen, 1 / span) - 1;
    if (perYear > FLAG_RULES.dilutionMaxPerYear) {
      flags.push({
        id: "dilution",
        title: "Diluted share count rose",
        detail: `Diluted shares grew about ${pct(perYear)} a year over ${span} years.`,
        rule: ruleOf("dilution"),
      });
    }
  }

  const last = years[years.length - 1];
  const sbc = last?.items.shareBasedComp?.value;
  const rev = last?.items.revenue?.value;
  if (sbc !== undefined && rev && rev > 0 && sbc / rev > FLAG_RULES.shareBasedPayMaxShareOfRevenue) {
    flags.push({
      id: "share-based-pay",
      title: "Share-based pay as a share of revenue",
      detail: `Share-based pay was ${pct(sbc / rev)} of revenue in fiscal ${last.fiscalYear}.`,
      rule: ruleOf("share-based-pay"),
    });
  }

  // Financial companies are skipped: their cash flow and debt do not measure the same thing.
  if (kindForSic(c.sic) !== "financial") {
    const lastFive = years.slice(-FLAG_RULES.cashBurnLookbackYears);
    const burnYears = lastFive.filter((p) => {
      const cfo = p.items.operatingCashFlow?.value;
      const capex = p.items.capex?.value;
      const ni = p.items.netIncome?.value;
      return cfo !== undefined && capex !== undefined && ni !== undefined && cfo - capex < 0 && ni > 0;
    });
    if (burnYears.length >= FLAG_RULES.cashBurnMinYears) {
      flags.push({
        id: "cash-burn",
        title: `Free cash flow negative in ${burnYears.length} of the last ${lastFive.length} years`,
        detail: `Free cash flow was negative while net income was positive in fiscal ${burnYears.map((p) => p.fiscalYear).join(", ")}.`,
        rule: ruleOf("cash-burn"),
      });
    }

    if (last) {
      const debt = totalDebt(last);
      const cash = liquidAssets(last);
      const opInc = last.items.operatingIncome?.value;
      const da = last.items.depreciationAmortization?.value;
      const interest = last.items.interestExpense?.value;
      const ebitda = opInc !== undefined && da !== undefined ? opInc + da : undefined;
      // Only a company that owes more than it holds in cash is checked; net-cash companies are not leveraged.
      const netDebt = debt !== undefined && debt > 0 && cash !== undefined ? debt - cash : undefined;
      const hasNetDebt = netDebt !== undefined && netDebt > 0;
      const leverage = hasNetDebt && ebitda !== undefined && ebitda > 0 ? netDebt / ebitda : undefined;
      const coverage = hasNetDebt && opInc !== undefined && opInc > 0 && interest !== undefined && interest > 0 ? opInc / interest : undefined;
      const raised = (leverage !== undefined && leverage > FLAG_RULES.netDebtMaxMultipleOfEbitda) ||
        (coverage !== undefined && coverage < FLAG_RULES.interestCoverageMin);
      if (raised) {
        const sentences = [
          leverage !== undefined ? `Net debt is ${leverage.toFixed(1)} times EBITDA.` : null,
          coverage !== undefined ? `Operating income covers interest ${coverage.toFixed(1)} times.` : null,
        ].filter(Boolean);
        flags.push({
          id: "leverage",
          title: `Debt measures for fiscal ${last.fiscalYear}`,
          detail: sentences.join(" "),
          rule: ruleOf("leverage"),
        });
      }
    }
  }

  return flags;
}

function label(item: LineItem): string {
  return { revenue: "Revenue", netIncome: "Net income", operatingIncome: "Operating income", operatingCashFlow: "Operating cash flow" }[item as string] ?? item;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
