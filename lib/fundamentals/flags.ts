import { accnUrl } from "./periods";
import { isFinancialSic } from "./sector";
import { liquidAssets, splitAdjustedShares, totalDebt } from "./metrics";
import type { CompanyFilings, LineItem } from "./types";

/** Something worth a closer look, with the rule that raised it and where to read more. No score. */
export interface Flag {
  id: string;
  title: string;
  detail: string;
  /** The rule, stated plainly, so the reader can judge it. */
  rule: string;
  filing?: { form: string; filed: string; url: string };
}

/** Every rule this module checks, so the UI can list what was checked when nothing is raised. */
export const FLAG_RULES: { id: string; rule: string }[] = [
  { id: "non-reliance", rule: "An 8-K under Item 4.02 in the last three years" },
  { id: "auditor-change", rule: "An 8-K under Item 4.01 in the last three years" },
  { id: "late-filing", rule: "A late-filing notice (NT 10-K or NT 10-Q) in the last three years" },
  { id: "restated", rule: "A revenue, profit or cash flow figure changed by more than 5% in a later filing, for one of the last three years" },
  { id: "receivables", rule: "Receivables grew more than 1.5 times as fast as revenue in each of the last two years" },
  { id: "dilution", rule: "Diluted shares grew more than 3% a year over three years" },
  { id: "share-based-pay", rule: "Share-based pay above 10% of revenue" },
  { id: "cash-burn", rule: "Negative free cash flow in three of the last five years while net income was positive" },
  { id: "leverage", rule: "Net debt above 4 times EBITDA, or operating income below 2 times interest" },
];

const ruleOf = (id: string) => FLAG_RULES.find((r) => r.id === id)!.rule;
const THREE_YEARS_MS = 3 * 365.25 * 86_400_000;
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

export function computeFlags(c: CompanyFilings): Flag[] {
  const flags: Flag[] = [];
  const cutoff = Date.parse(c.asOf) - THREE_YEARS_MS;
  const recent = c.filings.filter((f) => Date.parse(f.filed) >= cutoff);

  const fromFiling = (id: string, title: string, detail: string, match: (f: typeof recent[number]) => boolean) => {
    const hit = recent.find(match);
    if (hit) flags.push({ id, title, detail, rule: ruleOf(id), filing: { form: hit.form, filed: hit.filed, url: hit.url } });
  };
  fromFiling("non-reliance", "Earlier financial statements should not be relied on",
    "The company told investors that previously issued financial statements contained errors.",
    (f) => f.form.startsWith("8-K") && f.items.includes("4.02"));
  fromFiling("auditor-change", "Auditor changed",
    "The company reported a change in its independent accountant.",
    (f) => f.form.startsWith("8-K") && f.items.includes("4.01"));
  fromFiling("late-filing", "Filed a late-filing notice",
    "The company said it could not file a periodic report on time.",
    (f) => f.form === "NT 10-K" || f.form === "NT 10-Q");

  const years = c.annual;
  const lastThree = years.slice(-3);
  const moneyItems: LineItem[] = ["revenue", "netIncome", "operatingIncome", "operatingCashFlow"];
  for (const p of [...lastThree].reverse()) {
    const item = moneyItems.find((i) => {
      const fact = p.items[i];
      if (!fact?.restated) return false;
      const base = Math.max(Math.abs(fact.restated.original), 1);
      return Math.abs(fact.value - fact.restated.original) / base > 0.05;
    });
    if (item) {
      const fact = p.items[item]!;
      flags.push({
        id: "restated",
        title: `Fiscal ${p.fiscalYear} figures were changed later`,
        detail: `${label(item)} was first reported as ${fmt(fact.restated!.original)} and later as ${fmt(fact.value)}.`,
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
    const flagged = pairs.every(({ rev, rec }) => rev !== undefined && rec !== undefined && rec > 0.02 &&
      rec > 1.5 * Math.max(rev, 0));
    if (flagged) {
      flags.push({
        id: "receivables",
        title: "Unpaid customer bills are growing faster than sales",
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
    if (perYear > 0.03) {
      flags.push({
        id: "dilution",
        title: "Your share of the company keeps shrinking",
        detail: `Diluted shares grew about ${pct(perYear)} a year over ${span} years.`,
        rule: ruleOf("dilution"),
      });
    }
  }

  const last = years[years.length - 1];
  const sbc = last?.items.shareBasedComp?.value;
  const rev = last?.items.revenue?.value;
  if (sbc !== undefined && rev && rev > 0 && sbc / rev > 0.1) {
    flags.push({
      id: "share-based-pay",
      title: "Large share-based pay",
      detail: `Share-based pay was ${pct(sbc / rev)} of revenue in fiscal ${last.fiscalYear}.`,
      rule: ruleOf("share-based-pay"),
    });
  }

  if (!isFinancialSic(c.sic)) {
    const lastFive = years.slice(-5);
    const burnYears = lastFive.filter((p) => {
      const cfo = p.items.operatingCashFlow?.value;
      const capex = p.items.capex?.value;
      const ni = p.items.netIncome?.value;
      return cfo !== undefined && capex !== undefined && ni !== undefined && cfo - capex < 0 && ni > 0;
    });
    if (burnYears.length >= 3) {
      flags.push({
        id: "cash-burn",
        title: "Profits on paper, but cash going out",
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
      const leverage = debt !== undefined && cash !== undefined && ebitda && ebitda > 0 ? (debt - cash) / ebitda : undefined;
      const coverage = opInc !== undefined && interest && interest > 0 ? opInc / interest : undefined;
      if ((leverage !== undefined && leverage > 4) || (coverage !== undefined && coverage < 2)) {
        const parts = [
          leverage !== undefined ? `net debt is ${leverage.toFixed(1)} times EBITDA` : null,
          coverage !== undefined ? `operating income covers interest ${coverage.toFixed(1)} times` : null,
        ].filter(Boolean);
        flags.push({
          id: "leverage",
          title: "Heavy debt load",
          detail: `In fiscal ${last.fiscalYear}, ${parts.join(" and ")}.`,
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
