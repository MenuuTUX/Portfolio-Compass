"use client";

import { useMemo, useState } from "react";
import {
  availableRoom,
  overContributionTax,
  projectContributions,
  OVER_CONTRIBUTION_RATE_PER_MONTH,
  TFSA_LATEST_YEAR,
} from "@/lib/tfsa";

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const SCENARIOS = [0.03, 0.05, 0.07] as const;

function NumberField({
  label,
  hint,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        className="mt-1.5 h-11 w-full rounded-lg bg-surface-soft px-3 text-ink ring-1 ring-hairline focus-visible:outline-2 focus-visible:outline-compass"
      />
    </label>
  );
}

export default function TfsaPlanner() {
  const [yearTurned18, setYearTurned18] = useState(2022);
  const [contributed, setContributed] = useState(0);
  const [withdrawn, setWithdrawn] = useState(0);
  const [contributedThisYear, setContributedThisYear] = useState(0);
  const [monthly, setMonthly] = useState(250);
  const [years, setYears] = useState(20);
  // Read once on mount; the table only knows announced years.
  const [calendarYear] = useState(() => new Date().getFullYear());

  const valid =
    Number.isInteger(yearTurned18) && yearTurned18 >= 1900 && yearTurned18 <= TFSA_LATEST_YEAR &&
    contributed >= 0 && withdrawn >= 0 && contributedThisYear >= 0 && monthly >= 0 && Number.isInteger(years) && years >= 1 && years <= 60;

  const result = useMemo(() => {
    if (!valid) return null;
    const room = availableRoom({
      yearTurned18,
      year: TFSA_LATEST_YEAR,
      contributedBefore: contributed,
      withdrawnBefore: withdrawn,
      contributedThisYear,
    });
    const planned = monthly * 12;
    // Negative room is an existing excess, so it adds to whatever the plan puts in.
    const excess = Math.max(0, planned - room);
    return {
      room,
      planned,
      excess,
      monthlyTax: overContributionTax(excess, 1),
      paths: SCENARIOS.map((r) => ({ r, points: projectContributions({ monthly, years, annualReturn: r }) })),
    };
  }, [valid, yearTurned18, contributed, withdrawn, contributedThisYear, monthly, years]);

  return (
    <div className="space-y-8">
      <section aria-label="Your numbers" className="grid gap-4 rounded-2xl bg-surface-card p-5 ring-1 ring-hairline sm:grid-cols-2">
        <NumberField label="First year you were 18 or older and a Canadian resident" hint="Room builds from that year, or from 2009 if later." value={yearTurned18} onChange={setYearTurned18} min={1900} />
        <NumberField label="Put in so far" hint={`Across every TFSA you have, through ${TFSA_LATEST_YEAR - 1}.`} value={contributed} onChange={setContributed} step={100} />
        <NumberField label="Taken out so far" hint={`Withdrawals through ${TFSA_LATEST_YEAR - 1}. They return to your room each January 1.`} value={withdrawn} onChange={setWithdrawn} step={100} />
        <NumberField label="Already contributed this year" hint={`Put in during ${TFSA_LATEST_YEAR} so far. It comes off your room.`} value={contributedThisYear} onChange={setContributedThisYear} step={100} />
        <NumberField label="Planned each month" hint="What you could put in every month." value={monthly} onChange={setMonthly} step={25} />
        <NumberField label="Years to look ahead" hint="Whole years, 1 to 60." value={years} onChange={setYears} min={1} />
      </section>

      {!result ? (
        <p role="alert" className="text-sm text-rose-400">Check the numbers above. Amounts can&apos;t be negative and the year has to be a whole year no later than {TFSA_LATEST_YEAR}.</p>
      ) : (
        <>
          <section aria-label="Contribution room" className="space-y-3 rounded-2xl p-5 ring-1 ring-hairline">
            <p className="text-sm text-body">Your TFSA room for {TFSA_LATEST_YEAR}, from the CRA formula</p>
            {calendarYear > TFSA_LATEST_YEAR && (
              <p role="status" className="text-sm text-rose-400">
                This page only has CRA limits through {TFSA_LATEST_YEAR}, so it leaves out the room added on January 1, {calendarYear}. Check the CRA&apos;s published limit for {calendarYear} and add it to your room.
              </p>
            )}
            <p className="font-display text-4xl font-bold tabular-nums text-ink">{cad.format(result.room)}</p>
            {result.room < 0 && (
              <p className="text-sm text-rose-400">That is negative, which means you are over your limit. The CRA taxes the excess at {OVER_CONTRIBUTION_RATE_PER_MONTH * 100}% for each month it stays in the account. Check your CRA My Account before adding more.</p>
            )}
            <p className="text-sm text-body">
              Your plan puts in {cad.format(result.planned)} a year.{" "}
              {result.excess > 0 ? (
                <span className="text-rose-400">
                  That is {cad.format(result.excess)} more than your room. Left in for a month, the excess would cost about {cad.format(result.monthlyTax)} in CRA tax.
                </span>
              ) : (
                <span>That fits inside your room.</span>
              )}
            </p>
            <p className="text-xs text-muted">Check your real number in CRA My Account. Your bank&apos;s figure can lag, and this page only knows what you typed.</p>
          </section>

          <section aria-label="What steady saving adds up to" className="space-y-3 rounded-2xl p-5 ring-1 ring-hairline">
            <h2 className="font-display text-xl font-medium text-ink">What {cad.format(monthly)} a month adds up to</h2>
            <p className="text-sm text-body">After {years} years you would have put in {cad.format(monthly * 12 * years)}. The rest is growth at a steady rate you choose to assume.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th scope="col" className="py-1 pr-3 font-normal">Assumed return per year</th>
                    <th scope="col" className="py-1 pr-3 font-normal">Balance after {years} years</th>
                    <th scope="col" className="py-1 font-normal">Growth on top of what you put in</th>
                  </tr>
                </thead>
                <tbody>
                  {result.paths.map(({ r, points }) => {
                    const last = points[points.length - 1];
                    return (
                      <tr key={r} className="border-t border-hairline">
                        <th scope="row" className="py-2 pr-3 text-left font-normal text-body">{(r * 100).toFixed(0)}%</th>
                        <td className="py-2 pr-3 font-mono text-ink">{cad.format(last.balance)}</td>
                        <td className="py-2 font-mono text-ink">{cad.format(last.balance - last.contributed)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">
              These rates are assumptions, not forecasts. Real markets rise and fall, and a path that averages 5% can end well above or below this table. Test an actual mix of funds on the Portfolio page, which runs Monte Carlo paths on its past prices, or replay it in the Lab.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
