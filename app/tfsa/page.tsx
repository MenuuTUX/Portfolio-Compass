import type { Metadata } from "next";
import Link from "next/link";
import TfsaPlanner from "@/components/tfsa/TfsaPlanner";

export const metadata: Metadata = {
  title: "TFSA planner",
  description:
    "Work out your TFSA contribution room and see what steady monthly saving adds up to. Educational, not advice.",
};

const CRA = "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account";

export default function TfsaPage() {
  return (
    <main id="main" className="mx-auto max-w-[65ch] px-6 py-16 sm:py-24">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded text-sm text-muted transition-colors duration-[70ms] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass"
      >
        ← Portfolio Compass
      </Link>

      <h1 className="mt-6 font-display text-4xl font-bold text-ink" style={{ lineHeight: 1.16 }}>
        TFSA planner
      </h1>
      <p className="mt-3 text-body">
        A new TFSA is a long-term tool. This page shows how much room you have and what steady saving can add up to,
        so the plan starts from a number rather than a hunch.
      </p>

      <div className="mt-10">
        <TfsaPlanner />
      </div>

      <section className="mt-12 space-y-3 text-sm text-body">
        <h2 className="font-display text-xl font-medium text-ink">Rules that matter, from the CRA</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Room builds from the year you turn 18. The yearly limit is $7,000 for 2024, 2025 and 2026, and unused room carries forward.{" "}
            <a className="underline" href={`${CRA}/contributing/before.html`}>CRA: before you contribute</a>
          </li>
          <li>
            Putting in more than your room is taxed at 1% a month on the excess. Withdrawals return to your room on January 1 of the next year, not the same year.
          </li>
          <li>
            Income earned in a TFSA is not taxed, with exceptions. If a TFSA is found to carry on a business, the CRA can tax that income, and whether heavy trading is a business depends on the facts.{" "}
            <a className="underline" href="https://www.canada.ca/en/revenue-agency/services/tax/technical-information/income-tax/income-tax-folios-index/series-3-property-investments-savings-plans/series-3-property-investments-savings-plan-folio-10-registered-plans-individuals/income-tax-folio-s3-f10-c1-qualified-investments-rrsps-resps-rrifs-rdsps-tfsas.html">CRA: qualified investments folio</a>
          </li>
          <li>
            Tax withheld by another country on foreign dividends is not counted for the foreign tax credit when the income is earned in a TFSA, so it is generally a cost, not something you claim back.{" "}
            <a className="underline" href="https://www.canada.ca/en/revenue-agency/services/tax/technical-information/income-tax/income-tax-folios-index/series-5-international-residency/folio-2-foreign-tax-credits-deductions/income-tax-folio-s5-f2-c1-foreign-tax-credit.html">CRA: foreign tax credit folio</a>
          </li>
        </ul>
        <p className="text-xs text-muted">
          This is an educational calculator, not tax or investment advice, and it does not know your full situation. Limits are the CRA&apos;s published figures through 2026.
        </p>
      </section>
    </main>
  );
}
